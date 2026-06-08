import type { Department } from "@/types";

export function isLiquidatedDepartmentName(name: string): boolean {
  const lowered = name.toLowerCase();
  return lowered.includes("ликвид") || lowered.includes("(ликв");
}

export function filterActiveDepartments(departments: Department[]): Department[] {
  return departments.filter((department) => department.is_active && !isLiquidatedDepartmentName(department.name));
}
