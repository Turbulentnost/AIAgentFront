import type { OneCTasksResponse } from "@/types";
import { onecApiClient } from "./onecClient";

export const onecTasksApi = {
  list: () => onecApiClient.get<OneCTasksResponse>("/tasks").then((response) => response.data)
};
