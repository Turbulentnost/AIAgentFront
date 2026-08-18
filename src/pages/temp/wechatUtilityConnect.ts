import { agentsApi } from "@/api/endpoints";

export type WechatUtilityTestResult = Awaited<
  ReturnType<typeof agentsApi.testWechatUtilityConnection>
>;

export async function runWechatUtilityConnectionTestInConsole(): Promise<void> {
  console.clear();
  console.log("[WeChat utility] тестирование подключения через backend…");

  try {
    const result = await agentsApi.testWechatUtilityConnection();

    if (result.wsUrl) {
      console.log("[WeChat utility] wsUrl", result.wsUrl);
    }

    if (result.health) {
      console.log("[WeChat utility] /health", result.health);
    } else if (result.healthError) {
      console.warn("[WeChat utility] /health недоступен", result.healthError);
    }

    if (result.ok) {
      console.log("[WeChat utility] подключение успешно", result.wsMessage);
      return;
    }

    if (result.wsMessage) {
      console.error("[WeChat utility] ошибка", result.wsMessage);
      return;
    }

    console.error("[WeChat utility] ошибка", { error: result.error });
  } catch (caughtError) {
    console.error("[WeChat utility] ошибка запроса к backend", caughtError);
  }
}
