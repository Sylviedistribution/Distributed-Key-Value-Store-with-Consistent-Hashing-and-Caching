/**
 * Client — demonstrates TRANSPARENCY.
 *
 * This is the only interface an end user ever sees: put() and
 * get(). The client knows nothing about the hash ring, virtual
 * nodes, replicas, cache, migrations or failures happening
 * inside the cluster. From its point of view, the distributed
 * system behaves exactly like a local dictionary.
 */
class Client {

    constructor(cluster) {

        // The cluster reference is private: nothing internal
        // is exposed through this class.
        this.#cluster = cluster;

    }

    #cluster;

    put(key, value) {

        return this.#cluster.put(key, value);

    }

    get(key) {

        return this.#cluster.get(key);

    }

}

export default Client;
