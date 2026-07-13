/**
 * Caching layer combining two eviction policies:
 *
 *   1. LRU (Least Recently Used): when the cache is full, the
 *      entry not read for the longest time is evicted.
 *   2. TTL (Time To Live): every entry expires after `ttlMs`
 *      milliseconds, so the cache never serves data too old.
 *
 * Implementation trick: a JavaScript Map preserves insertion
 * order. On every read we delete + re-insert the key, so the
 * FIRST key of the Map is always the least recently used one.
 * Eviction is therefore O(1).
 */
class Cache {

    constructor(capacity = 3, ttlMs = 3000) {

        this.capacity = capacity;

        this.ttlMs = ttlMs;

        // key -> { value, expiresAt }
        this.map = new Map();

        this.hits = 0;

        this.misses = 0;

    }

    /**
     * Read a value. Returns undefined on a miss
     * (absent OR expired entry).
     */
    get(key) {

        const entry = this.map.get(key);

        if (!entry) {
            this.misses++;
            return undefined;
        }

        // TTL check: expired entries count as misses.
        if (Date.now() > entry.expiresAt) {
            this.map.delete(key);
            this.misses++;
            return undefined;
        }

        // Refresh the LRU position (delete + re-insert moves
        // the key to the "most recently used" end of the Map).
        this.map.delete(key);
        this.map.set(key, entry);

        this.hits++;

        return entry.value;

    }

    /**
     * Store a value. Evicts the LRU entry if the cache is full.
     */
    set(key, value) {

        if (this.map.has(key)) this.map.delete(key);

        if (this.map.size >= this.capacity) {

            const oldest = this.map.keys().next().value;

            this.map.delete(oldest);

            console.log(`   [CACHE] LRU eviction of "${oldest}"`);

        }

        this.map.set(key, {
            value,
            expiresAt: Date.now() + this.ttlMs
        });

    }

    /**
     * Remove an entry, typically after a write, so the cache
     * never serves a stale value.
     */
    invalidate(key) {

        this.map.delete(key);

    }

}

export default Cache;
