import { hash } from "../utils/hash.js";

class Node {

    constructor(name) {

        this.name = name;

        this.position = hash(name);

        this.data = new Map();

        this.active = true;

    }

    put(key, value) {

        this.data.set(key, value);

    }

    get(key) {

        return this.data.get(key);

    }

    remove(key) {

        this.data.delete(key);

    }

    has(key) {

        return this.data.has(key);

    }

    fail() {

        this.active = false;

    }

    recover() {

        this.active = true;

    }

    entries() {

        return [...this.data.entries()];

    }

    clear() {

        this.data.clear();

    }

}

export default Node;