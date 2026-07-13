import HashRing from "../models/HashRing.js";
import Cache from "../models/Cache.js";

/**
 * Cluster — the facade of the whole system (TRANSPARENCY).
 *
 * Availability strategy: every key is written to `replicas`
 * distinct physical nodes (the owner + the next node on the
 * ring, as in Amazon Dynamo). On read, if the owner is down,
 * we transparently fail over to the next replica.
 */
class Cluster {

    constructor({ vnodes = 100, replicas = 2, cacheSize = 3, ttlMs = 3000 } = {}) {

        this.ring = new HashRing(vnodes);

        this.replicas = replicas;

        this.cache = new Cache(cacheSize, ttlMs);

    }

    /**
     * Node JOIN.
     *
     * Consistent hashing guarantees that only the keys located
     * on the arc just before the new node change owner. So we
     * snapshot ownership BEFORE the join, then migrate ONLY the
     * keys whose owner changed — and we measure it.
     *
     * (The previous version collected every key, cleared every
     * node and reinserted everything: a 100% data shuffle that
     * defeated the whole point of consistent hashing.)
     */
    addNode(node) {

        const before = this.#ownershipSnapshot();

        this.ring.addNode(node);

        let moved = 0;
        let total = 0;

        for (const [key, oldOwner] of before) {

            total++;

            const newOwner = this.ring.getNode(key);

            if (newOwner.name !== oldOwner.name) {

                const value = oldOwner.get(key);

                oldOwner.remove(key);
                newOwner.put(key, value);

                this.#syncReplicas(key, value);

                moved++;

                console.log(`   [MIGRATION] ${key}: ${oldOwner.name} -> ${newOwner.name}`);

            }

        }

        console.log(`+ ${node.name} joined | keys moved: ${moved}/${total}`);

    }

    /**
     * Node LEAVE (graceful departure): the node hands its data
     * over to the new owners BEFORE leaving. No data is lost.
     */
    removeNode(nodeName) {

        const node = this.ring.nodes.get(nodeName);

        if (!node) return;

        const entries = node.entries();

        this.ring.removeNode(nodeName);

        for (const [key, value] of entries) {

            const target = this.ring.getNode(key);

            target.put(key, value);

            this.#syncReplicas(key, value);

        }

        console.log(`- ${nodeName} left gracefully | ${entries.length} keys migrated`);

    }

    /**
     * Node FAILURE (crash): unlike removeNode(), nothing is
     * migrated — the node simply stops responding. Availability
     * now relies on the replicas.
     */
    failNode(nodeName) {

        const node = this.ring.nodes.get(nodeName);

        if (node) {
            node.fail();
            console.log(`!! Simulated failure of ${nodeName}`);
        }

    }

    /**
     * Bring a failed node back online.
     */
    recoverNode(nodeName) {

        const node = this.ring.nodes.get(nodeName);

        if (node) {
            node.recover();
            console.log(`OK ${nodeName} recovered`);
        }

    }

    /**
     * Store a key/value pair on `replicas` distinct nodes.
     * The cache entry is invalidated so a later read can never
     * return a stale value.
     */
    put(key, value) {

        const targets = this.ring.getNodes(key, this.replicas);

        let written = 0;

        for (const node of targets) {

            if (node.active) {
                node.put(key, value);
                written++;
            }

        }

        this.cache.invalidate(key);

        const names = targets
            .filter(n => n.active)
            .map(n => n.name)
            .join(", ");

        console.log(`PUT ${key} -> written to [${names}]`);

        if (written === 0) {
            console.log("   /!\\ Write failed: all replicas are down");
        }

    }

    /**
     * Retrieve a value:
     *   1. Try the cache first (fast path).
     *   2. Otherwise ask the owner, then fail over to the
     *      replicas, silently skipping dead nodes.
     */
    get(key) {

        const cached = this.cache.get(key);

        if (cached !== undefined) {
            console.log(`GET ${key} -> [CACHE HIT] ${JSON.stringify(cached)}`);
            return cached;
        }

        const targets = this.ring.getNodes(key, this.replicas);

        for (const node of targets) {

            if (!node.active) {
                console.log(`   [FAILOVER] ${node.name} unreachable, trying next replica...`);
                continue;
            }

            if (node.has(key)) {

                const value = node.get(key);

                this.cache.set(key, value);

                console.log(`GET ${key} -> [MISS, served by ${node.name}] ${JSON.stringify(value)}`);

                return value;

            }

        }

        console.log(`GET ${key} -> NOT FOUND (or all replicas are down)`);

        return undefined;

    }

    /**
     * Display every node and its stored keys (owner + replicas).
     */
    printCluster() {

        console.log("\n========== CLUSTER ==========\n");

        for (const node of this.ring.nodes.values()) {

            const status = node.active ? "" : "   (DOWN)";

            console.log(node.name + status);

            if (node.data.size === 0) {
                console.log("   (empty)");
            }

            for (const [key, value] of node.data) {
                console.log(`   ${key} -> ${value.name}`);
            }

            console.log();

        }

    }

    /**
     * Synchronize the replicas of a key: write it on its current
     * replica nodes and REMOVE it everywhere else, so no stale
     * copy survives a migration.
     */
    #syncReplicas(key, value) {

        const targets = this.ring.getNodes(key, this.replicas);

        const targetNames = new Set(targets.map(n => n.name));

        for (const node of this.ring.nodes.values()) {

            if (targetNames.has(node.name)) {

                if (node.active) node.put(key, value);

            } else if (node.has(key)) {

                node.remove(key);

            }

        }

    }

    /**
     * Map every key to its current OWNER node (ignoring replica
     * copies). Used by addNode() to measure how many keys move.
     */
    #ownershipSnapshot() {

        const owners = new Map();

        for (const node of this.ring.nodes.values()) {

            for (const key of node.data.keys()) {

                if (this.ring.getNode(key).name === node.name) {
                    owners.set(key, node);
                }

            }

        }

        return owners;

    }

}

export default Cluster;
