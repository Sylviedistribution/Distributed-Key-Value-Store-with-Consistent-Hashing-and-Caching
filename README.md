# Distributed Key-Value Store with Consistent Hashing and Caching

A Node.js simulation of a distributed key-value storage system. It demonstrates how distributed systems achieve **scalability**, **availability**, and **transparency** through four core mechanisms required by the checkpoint:

1. **Consistent hashing** to assign keys to nodes dynamically.
2. **Node join/leave** with minimal (and measured) data movement.
3. A **caching layer** combining LRU eviction and TTL expiration.
4. **Node failure simulation** with transparent failover to replicas.

## Requirements

- Node.js 18 or higher
- One dependency: [chalk](https://www.npmjs.com/package/chalk) (colored console output)

## How to run

```bash
npm install
npm start        # or: node index.js
```

Optionally, with Docker:

```bash
docker compose up --build
```

## Project structure

```
.
├── index.js                 # Entry point: launches the simulation
├── data/
│   └── sampleData.js        # The checkpoint sample data (user:101 ... user:106)
├── models/
│   ├── Node.js              # A simulated storage server (data + active flag)
│   ├── HashRing.js          # Consistent hashing ring with virtual nodes
│   └── Cache.js             # Caching layer (LRU eviction + TTL expiration)
├── services/
│   ├── Cluster.js           # Facade orchestrating ring, replicas, cache, failures
│   └── Client.js            # The only interface a user sees (transparency)
├── demo/
│   └── simulation.js        # End-to-end demonstration scenario
├── k8s/                     # Kubernetes manifests (deployment + service)
├── Dockerfile
└── docker-compose.yml
```

## How it works

### 1. Consistent hashing (`models/HashRing.js`)

Both nodes and keys are hashed (SHA-1, truncated to 32 bits — see `utils/hash.js`) onto the same circular space of 2^32 positions. A key belongs to the first node encountered when walking the ring clockwise from the key's position.

Each physical node is projected **250 times** onto the ring as *virtual nodes*. With a single position per node, pure chance can give one node most of the keys, or hand a joining node an empty arc; hundreds of virtual points statistically smooth the distribution.

### 2. Join / leave with minimal data movement (`services/Cluster.js`)

- **Join (`addNode`)**: ownership is snapshotted before the join, then only the keys whose owner changed are migrated — and the migration is measured. In the demo, when Node D joins a 3-node cluster holding 6 keys, **only 2 keys move** (the theoretical expectation is 1/4 of the keys). A naive `hash(key) % nodeCount` scheme would have relocated ~75% of them.
- **Leave (`removeNode`)**: a graceful departure. The node hands its data to the new owners before leaving the ring, so nothing is lost.

### 3. Caching layer (`models/Cache.js`)

Reads hit an in-memory cache before touching any node:

- **LRU**: when the cache is full, the least recently used entry is evicted. A JavaScript `Map` preserves insertion order, so refreshing a key on read keeps the LRU entry at the head — eviction is O(1).
- **TTL**: every entry expires after a configurable delay, so the cache never serves data that is too old.

Writes invalidate the corresponding cache entry to preserve consistency. The demo uses a deliberately tiny cache (3 entries, 3 s TTL) so evictions and expirations are visible in the logs.

### 4. Failure simulation and limited availability

Every key is written to **2 distinct physical nodes**: its owner and the next node on the ring (the replication strategy popularized by Amazon Dynamo). A crash is simulated by flipping the node's `active` flag — no migration happens, unlike a graceful leave. Reads then transparently fail over to the surviving replica:

```
!! Simulated failure of Node D
   [FAILOVER] Node D unreachable, trying next replica...
GET user:104 -> [MISS, served by Node A] {"name":"Diana"}
```

The system keeps answering with a reduced safety margin — the "limited availability" required by the checkpoint.

### 5. Transparency (`services/Client.js`)

The end user only ever interacts with the `Client` class, which exposes exactly two methods: `put(key, value)` and `get(key)`. The ring, virtual nodes, replicas, cache, migrations and failovers are entirely hidden — the distributed store behaves like a local dictionary even while nodes join, leave, or crash underneath.

## Sample data

| Key      | Value               |
|----------|---------------------|
| user:101 | {"name": "Alice"}   |
| user:102 | {"name": "Bob"}     |
| user:103 | {"name": "Charlie"} |
| user:104 | {"name": "Diana"}   |
| user:105 | {"name": "Eve"}     |
| user:106 | {"name": "Frank"}   |

## Configuration

The cluster accepts four options (see `demo/simulation.js`):

| Option      | Default | Description                          |
|-------------|---------|--------------------------------------|
| `vnodes`    | 250     | Virtual nodes per physical node      |
| `replicas`  | 2       | Distinct nodes storing each key      |
| `cacheSize` | 3       | LRU cache capacity                   |
| `ttlMs`     | 3000    | Cache entry lifetime in milliseconds |

## Containerization (bonus)

The repository also ships a `Dockerfile`, a `docker-compose.yml`, and Kubernetes manifests (`k8s/`). In a production version of this system, each storage node would run as its own container, and Kubernetes would provide for real the self-healing and scaling behaviors that this project simulates in-process.

## Possible extensions

- Expose the store through a REST API (one Express server per node).
- Read quorum: read from 2 replicas and compare versions.
- Hinted handoff: buffer writes destined to a dead node and replay them on recovery.
