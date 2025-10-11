/**
 * 配列と、各要素から比較用の値を生成するmapper関数を受け取り、
 * その値に基づいて重複を取り除いた新しい配列を返します。
 *
 * @template T - 配列内の要素の型。
 * @template U - mapper関数によって返される値の型。
 * @param {T[]} arr - 処理対象の配列。
 * @param {(item: T) => U} mapper - 各要素を比較用の値に変換する関数。
 * @returns {T[]} - 重複が取り除かれた新しい配列。
 */
export function uniqBy<T, U>(arr: T[], mapper: (item: T) => U): T[] {
	const seen = new Set<U>();
	const result: T[] = [];

	for (const item of arr) {
		const key = mapper(item);
		if (!seen.has(key)) {
			seen.add(key);
			result.push(item);
		}
	}

	return result;
}
