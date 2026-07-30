export interface SearchResult {
  document: string;
  index: number;
  distance: number;
}

export class InMemoryVectorStore {
  readonly dimension: number;

  private readonly documents: string[] = [];
  private readonly embeddings: number[][] = [];

  constructor(dimension: number) {
    if (!Number.isInteger(dimension) || dimension <= 0) {
      throw new RangeError("向量维度必须是正整数。");
    }

    this.dimension = dimension;
  }

  get size(): number {
    return this.documents.length;
  }

  add(documents: readonly string[], embeddings: readonly (readonly number[])[]): number {
    if (documents.length !== embeddings.length) {
      throw new RangeError("文档数量必须与向量数量一致。");
    }

    documents.forEach((document, index) => {
      if (document.trim().length === 0) {
        throw new TypeError(`第 ${index} 篇文档为空。`);
      }

      this.validateEmbedding(embeddings[index]!, `第 ${index} 个文档向量`);
    });

    this.documents.push(...documents);
    this.embeddings.push(...embeddings.map((embedding) => [...embedding]));
    return this.size;
  }

  search(query: readonly number[], topK: number): SearchResult[] {
    this.validateEmbedding(query, "查询向量");

    if (!Number.isInteger(topK) || topK <= 0) {
      throw new RangeError("topK 必须是正整数。");
    }

    return this.embeddings
      .map((embedding, index) => ({
        document: this.documents[index]!,
        index,
        distance: squaredL2Distance(query, embedding),
      }))
      .sort((left, right) => left.distance - right.distance || left.index - right.index)
      .slice(0, Math.min(topK, this.size));
  }

  private validateEmbedding(embedding: readonly number[], label: string): void {
    if (embedding.length !== this.dimension) {
      throw new RangeError(
        `${label}维度错误：期望 ${this.dimension}，实际 ${embedding.length}。`,
      );
    }

    if (embedding.some((value) => !Number.isFinite(value))) {
      throw new TypeError(`${label}包含非有限数值。`);
    }
  }
}

function squaredL2Distance(left: readonly number[], right: readonly number[]): number {
  let distance = 0;

  for (let index = 0; index < left.length; index += 1) {
    const delta = left[index]! - right[index]!;
    distance += delta * delta;
  }

  return distance;
}
