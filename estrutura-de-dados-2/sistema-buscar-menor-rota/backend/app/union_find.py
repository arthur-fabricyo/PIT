"""Union-Find (conjuntos disjuntos) com união por rank e compressão de caminho."""

from collections.abc import Hashable, Iterable


class UnionFind:
    def __init__(self, elementos: Iterable[Hashable]) -> None:
        self._pai = {e: e for e in elementos}
        self._rank = dict.fromkeys(self._pai, 0)
        self.componentes = len(self._pai)

    def find(self, x: Hashable) -> Hashable:
        raiz = x
        while self._pai[raiz] != raiz:
            raiz = self._pai[raiz]
        # compressão de caminho: todos no caminho passam a apontar para a raiz
        while self._pai[x] != raiz:
            proximo = self._pai[x]
            self._pai[x] = raiz
            x = proximo
        return raiz

    def union(self, a: Hashable, b: Hashable) -> bool:
        """Une os conjuntos de a e b. Retorna False se já estavam juntos."""
        raiz_a, raiz_b = self.find(a), self.find(b)
        if raiz_a == raiz_b:
            return False
        if self._rank[raiz_a] < self._rank[raiz_b]:
            raiz_a, raiz_b = raiz_b, raiz_a
        self._pai[raiz_b] = raiz_a
        if self._rank[raiz_a] == self._rank[raiz_b]:
            self._rank[raiz_a] += 1
        self.componentes -= 1
        return True
