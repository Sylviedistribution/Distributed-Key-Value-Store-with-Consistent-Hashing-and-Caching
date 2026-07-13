import chalk from "chalk";
import Node from "../models/Node.js";
import Cluster from "../services/Cluster.js";
import Client from "../services/Client.js";
import sampleData from "../data/sampleData.js";

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

/**
 * End-to-end demonstration, following the checkpoint
 * requirements step by step:
 *
 *   1. Consistent hashing distributes the sample data.
 *   2. Caching layer: LRU eviction + TTL expiration.
 *   3. Node JOIN  -> minimal data movement (measured).
 *   4. Node LEAVE -> graceful migration, no data loss.
 *   5. Node FAILURE -> reads still work via replicas.
 *   6. Transparency: the user only ever calls put()/get().
 */
async function runSimulation() {

    console.clear();

    console.log(chalk.blue("==================================="));
    console.log(chalk.blue(" Distributed Key Value Store Demo "));
    console.log(chalk.blue("==================================="));

    const cluster = new Cluster({
        vnodes: 250,   // virtual nodes per physical node (tuned for a smooth distribution)
        replicas: 2,   // each key lives on 2 distinct nodes
        cacheSize: 3,  // tiny cache to make LRU eviction visible
        ttlMs: 3000    // short TTL to make expiration visible
    });

    // The end user only ever talks to this client (transparency).
    const client = new Client(cluster);

    console.log(chalk.cyan("\n1) CLUSTER CREATION (3 nodes)\n"));

    cluster.addNode(new Node("Node A"));
    cluster.addNode(new Node("Node B"));
    cluster.addNode(new Node("Node C"));

    cluster.ring.printRing();

    console.log(chalk.cyan("2) LOADING THE SAMPLE DATA\n"));

    for (const item of sampleData) {
        client.put(item.key, item.value);
    }

    cluster.printCluster();

    console.log(chalk.cyan("3) READS + CACHE (LRU / TTL)\n"));

    client.get("user:101"); // MISS -> fetched from a node
    client.get("user:101"); // HIT  -> served by the cache
    client.get("user:102");
    client.get("user:103");
    client.get("user:104"); // cache capacity = 3 -> LRU eviction

    console.log(chalk.gray("\n...waiting 3.5s to exceed the TTL...\n"));
    await sleep(3500);

    client.get("user:104"); // TTL expired -> MISS again

    console.log(chalk.magenta(
        `\nCache stats -> hits: ${cluster.cache.hits}, misses: ${cluster.cache.misses}`
    ));

    console.log(chalk.cyan("\n4) NODE JOIN: minimal data movement\n"));

    cluster.addNode(new Node("Node D"));

    cluster.printCluster();

    console.log(chalk.cyan("5) GRACEFUL NODE LEAVE\n"));

    cluster.removeNode("Node B");

    cluster.printCluster();

    console.log(chalk.cyan("6) NODE FAILURE: limited availability\n"));

    cluster.failNode("Node D"); // Node D owns most keys at this point: perfect failover demo

    for (const item of sampleData) {
        client.get(item.key); // dead owner -> failover to replicas
    }

    cluster.recoverNode("Node D");

    console.log(chalk.cyan("\n7) TRANSPARENCY\n"));

    console.log("The user only called client.put() / client.get(): they never");
    console.log("knew where the data lived, how many nodes existed, or which");
    console.log("ones crashed. All node-level complexity is hidden.");

}

export default runSimulation;
