import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { documentsApi } from "@/api/endpoints";
export default function KnowledgeBase() {
  const [query, setQuery] = useState("");
  const search = useMutation({ mutationFn: (q: string) => documentsApi.search(q) });
  return <div className="card"><h2>База знаний RAG</h2><form onSubmit={(e) => { e.preventDefault(); if (query) search.mutate(query); }}><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Введите запрос" /><button>Искать</button></form><pre>{JSON.stringify(search.data ?? [], null, 2)}</pre></div>;
}
