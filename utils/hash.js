import crypto from "crypto";

/**
 * Generates a numeric hash from a string.
 *
 * @param {string} value
 * @returns {number}
 */
export function hash(value) {

    const hex = crypto
        .createHash("sha1")
        .update(value)
        .digest("hex");

    /*
        SHA1 = 40 hexadecimal characters.

        We keep the first 8 characters
        (32 bits).

        Example:

        f2c9ab34...

        becomes

        0xF2C9AB34
    */

    return parseInt(hex.substring(0, 8), 16);

}