import type { ReactNode } from "react";
import styles from "../NdControlAgent.module.css";

type Props = {
  children: ReactNode;
  className?: string;
};

export default function NdControlDataTable({ children, className }: Props) {
  return (
    <div className={styles.tableWrap}>
      <div className={styles.tableScroll}>
        <table className={`${styles.table} ${className ?? ""}`.trim()}>{children}</table>
      </div>
    </div>
  );
}
