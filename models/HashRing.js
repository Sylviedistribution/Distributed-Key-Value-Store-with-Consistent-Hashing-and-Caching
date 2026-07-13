import { hash } from "../utils/hash.js";

/**
 * Consistent hashing ring.
 *
 * Both nodes and keys are hashed onto the same circular space
 * (0 to 2^32 - 1). A key belongs to the first node found when
 * walking the ring clockwise from the key's position.
 *
 * VIRTUAL NODES: each physical node is projected `vnodes` times
 * onto the ring ("Node A#vn0", "Node A#vn1", ...). With a single
 * position per node, pure chance can give one node most of the
 * keys (or a joining node an empty arc). Hundreds of virtual
 * points statistically smooth the distribution.
 */
class HashRing {

    constructor(vnodes = 100) {

        this.vnodes = vnodes;

        // Sorted array of { position, node } — the ring itself.
        this.ring = [];

        // name -> Node, the physical nodes.
        this.nodes = new Map();

    }

    /**
     * Add a node: project its virtual points onto the ring.
     * The ring is always kept sorted.
     */
    addNode(node) {

        this.nodes.set(node.name, node);

        for (let i = 0; i < this.vnodes; i++) {

            this.ring.push({
                position: hash(`${node.name}#vn${i}`),
                node
            });

        }

        this.ring.sort((a, b) => a.position - b.position);

    }

    /**
     * Remove a node and all of its virtual points.
     */
    removeNode(nodeName) {

        this.nodes.delete(nodeName);

        this.ring = this.ring.filter(
            entry => entry.node.name !== nodeName
        );

    }

    /**
     * Find the single node responsible for a key (its owner).
     */
    getNode(key) {

        return this.getNodes(key, 1)[0];

    }

    /**
     * Find up to `count` DISTINCT physical nodes responsible for
     * a key: the owner first, then its replicas, walking the ring
     * clockwise (wrapping around at the end).
     */
    getNodes(key, count = 1) {

        if (this.ring.length === 0) return [];

        const keyHash = hash(key);

        // First virtual point at or after the key's position.
        let start = this.ring.findIndex(
            entry => keyHash <= entry.position
        );

        /*
            Wrap around the ring: if the key is larger than every
            position, its owner is the first point of the ring.
        */
        if (start === -1) start = 0;

        // Walk clockwise, collecting distinct PHYSICAL nodes
        // (consecutive virtual points may share the same node).
        const result = [];
        const seen = new Set();

        for (let i = 0; i < this.ring.length && result.length < count; i++) {

            const { node } = this.ring[(start + i) % this.ring.length];

            if (!seen.has(node.name)) {
                seen.add(node.name);
                result.push(node);
            }

        }

        return result;

    }

    /**
     * Display the ring (physical nodes and their virtual points).
     */
    printRing() {

        console.log("\n========== HASH RING ==========\n");

        for (const node of this.nodes.values()) {

            const points = this.ring
                .filter(e => e.node.name === node.name)
                .length;

            console.log(
                `${node.name.padEnd(10)} -> ${points} virtual points on the ring`
            );

        }

        console.log("\n===============================\n");

    }

}

export default HashRing;
