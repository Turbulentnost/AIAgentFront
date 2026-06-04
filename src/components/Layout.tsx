import type { ReactNode } from "react";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
export default function Layout({ title, children }: { title: string; children: ReactNode }) { return <div className="shell"><Sidebar /><main><Topbar title={title} /><section className="content">{children}</section></main></div>; }
