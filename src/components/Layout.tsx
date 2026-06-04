import type { ReactNode } from "react";
import Topbar from "./Topbar";

export default function Layout({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="shell">
      <Topbar title={title} />
      <main>
        <section className="content">{children}</section>
      </main>
    </div>
  );
}
