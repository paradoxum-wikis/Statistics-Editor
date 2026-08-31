/**
 * @param {string} content
 * @returns {string}
 */
export function hashFactoryText(content) {
	const hasher = new Bun.CryptoHasher("sha256");
	hasher.update(content.trimEnd());
	return hasher.digest("hex").slice(0, 16);
}
