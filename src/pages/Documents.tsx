import { FormEvent, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { documentsApi } from "@/api/endpoints";
import type { Document, DocumentType } from "@/types";

const documentTypes: { value: DocumentType; label: string }[] = [
  { value: "other", label: "Прочее" },
  { value: "regulation", label: "Регламент" },
  { value: "tz", label: "ТЗ" },
  { value: "contract", label: "Договор" },
  { value: "specification", label: "Спецификация" }
];

export default function Documents() {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [documentType, setDocumentType] = useState<DocumentType>("other");
  const [isKnowledgeBase, setIsKnowledgeBase] = useState(false);
  const [uploaded, setUploaded] = useState<Document | null>(null);
  const [error, setError] = useState<string | null>(null);

  const uploadMutation = useMutation({
    mutationFn: () =>
      documentsApi.upload(file!, {
        title: title || undefined,
        document_type: documentType,
        is_knowledge_base: isKnowledgeBase
      }),
    onSuccess: (doc) => {
      setUploaded(doc);
      setError(null);
      setFile(null);
      setTitle("");
    },
    onError: () => setError("Не удалось загрузить документ")
  });

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) {
      setError("Выберите файл");
      return;
    }
    setError(null);
    uploadMutation.mutate();
  }

  return (
    <div className="grid two-columns">
      <form className="card form-card" onSubmit={handleSubmit}>
        <h2>Загрузка документа</h2>
        <p>PDF, DOCX, XLSX — хранение в MinIO, индексация в Qdrant.</p>
        <input
          type="file"
          accept=".pdf,.doc,.docx,.xls,.xlsx"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          required
        />
        <input placeholder="Название (необязательно)" value={title} onChange={(e) => setTitle(e.target.value)} />
        <select value={documentType} onChange={(e) => setDocumentType(e.target.value as DocumentType)}>
          {documentTypes.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
        <label>
          <input type="checkbox" checked={isKnowledgeBase} onChange={(e) => setIsKnowledgeBase(e.target.checked)} />
          {" "}Добавить в базу знаний
        </label>
        {error && <div className="error">{error}</div>}
        <button disabled={uploadMutation.isPending}>{uploadMutation.isPending ? "Загружаем..." : "Загрузить"}</button>
      </form>
      <div className="card">
        <h2>Последняя загрузка</h2>
        {!uploaded ? (
          <p>После успешной загрузки здесь появятся метаданные документа.</p>
        ) : (
          <dl className="details">
            <dt>Название</dt>
            <dd>{uploaded.title}</dd>
            <dt>Файл</dt>
            <dd>{uploaded.original_filename || "-"}</dd>
            <dt>Статус</dt>
            <dd>{uploaded.processing_status}</dd>
            <dt>Индексация</dt>
            <dd>{uploaded.is_indexed ? "Да" : "Нет"}</dd>
            <dt>База знаний</dt>
            <dd>{uploaded.is_knowledge_base ? "Да" : "Нет"}</dd>
          </dl>
        )}
      </div>
    </div>
  );
}
