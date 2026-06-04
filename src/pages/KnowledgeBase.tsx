import { FormEvent, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { documentsApi } from "@/api/endpoints";

export default function KnowledgeBase() {
  const [query, setQuery] = useState("");
  const search = useMutation({ mutationFn: (q: string) => documentsApi.search(q) });

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (query.trim()) search.mutate(query.trim());
  }

  return (
    <div className="card">
      <h2>База знаний RAG</h2>
      <form onSubmit={handleSubmit}>
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Введите запрос" />
        <button disabled={search.isPending}>{search.isPending ? "Ищем..." : "Искать"}</button>
      </form>
      {search.isError && <p className="error">Ошибка поиска</p>}
      {!search.data?.length && search.isSuccess && <p>Ничего не найдено.</p>}
      {search.data && search.data.length > 0 && (
        <table>
          <tbody>
            {search.data.map((hit, index) => (
              <tr key={`${hit.document_id ?? "hit"}-${index}`}>
                <td>
                  <small>score: {hit.score.toFixed(3)}</small>
                  <br />
                  {hit.content || "(пусто)"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
