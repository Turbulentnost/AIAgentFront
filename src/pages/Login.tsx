import { FormEvent, useId, useRef, useState } from "react";
import {
  BarChart3,
  BrainCircuit,
  Check,
  ChevronDown,
  CircleHelp,
  Eye,
  EyeOff,
  FileText,
  Globe,
  LockKeyhole,
  Scale,
  UserRound
} from "lucide-react";
import { AxiosError } from "axios";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "@/auth/AuthContext";
import ThemeToggle from "@/components/ThemeToggle";
import styles from "./Login.module.css";

interface FeatureCard {
  id: string;
  iconSrc: string;
  iconAlt: string;
  highlight?: string;
  subtitle?: string;
  title?: string;
  description: readonly [string, string] | readonly [string, string, string];
}

const featureCards: FeatureCard[] = [
  {
    id: "agents",
    iconSrc: "/login-feature-robot.png",
    iconAlt: "ИИ-агент",
    highlight: "12",
    subtitle: "активных агентов",
    description: ["Работают над вашими", "процессами"]
  },
  {
    id: "knowledge",
    iconSrc: "/login-feature-book.png",
    iconAlt: "База знаний",
    title: "RAG + база знаний",
    description: [
      "Агенты используют актуальные",
      "данные и корпоративные",
      "источники"
    ]
  },
  {
    id: "access",
    iconSrc: "/login-feature-shield.png",
    iconAlt: "Контролируемый доступ",
    title: "Контролируемый доступ",
    description: [
      "Роли, права и политика",
      "безопасности на уровне",
      "корпорации"
    ]
  }
];

const agentSteps = ["Извлечение данных", "Проверка соответствия", "Формирование отчета"];

type LanguageCode = "ru" | "en";

const languages: { code: LanguageCode; label: string; icon: string }[] = [
  { code: "ru", label: "Русский", icon: "RU" },
  { code: "en", label: "English", icon: "EN" }
];

export default function Login() {
  const navigate = useNavigate();
  const { isAuthenticated, login, loginWith1C } = useAuth();
  const emailId = useId();
  const fioId = useId();
  const passwordId = useId();
  const newPasswordId = useId();
  const confirmPasswordId = useId();
  const [isCorporateMode, setIsCorporateMode] = useState(false);
  const [email, setEmail] = useState("");
  const [fio, setFio] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [requiresPasswordChange, setRequiresPasswordChange] = useState(false);
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState<LanguageCode>("ru");
  const [isLanguageOpen, setIsLanguageOpen] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submitInFlight = useRef(false);
  const currentLanguage = languages.find((language) => language.code === selectedLanguage) ?? languages[0];

  if (isAuthenticated) return <Navigate to="/" replace />;

  function getCorporateLoginError(err: unknown): string {
    if (err instanceof AxiosError) {
      const detail = err.response?.data?.detail;
      if (typeof detail === "string" && detail.trim()) return detail;
      if (typeof detail === "object" && detail && "message" in detail) {
        const message = detail.message;
        if (typeof message === "string" && message.trim()) return message;
      }
      if (err.response?.status === 409) {
        return "Вход уже выполняется. Подождите несколько секунд и повторите попытку.";
      }
    }
    return "Не удалось войти через корпоративную учётную запись";
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitInFlight.current) return;
    setError(null);
    if (!isCorporateMode && requiresPasswordChange && newPassword !== confirmPassword) {
      setError("Новый пароль и подтверждение не совпадают");
      return;
    }
    submitInFlight.current = true;
    setIsSubmitting(true);
    try {
      if (isCorporateMode) {
        await loginWith1C({ fio: fio.trim(), password });
      } else {
        await login({
          email,
          password,
          new_password: requiresPasswordChange ? newPassword : undefined
        });
      }
      navigate(isCorporateMode ? "/tasks" : "/", { replace: true });
    } catch (err) {
      if (!isCorporateMode && err instanceof AxiosError && err.response?.status === 428) {
        setRequiresPasswordChange(true);
        setError("Для первого входа задайте новый пароль");
      } else if (isCorporateMode) {
        if (err instanceof Error && err.message.includes("ФИО")) {
          setError(err.message);
        } else if (err instanceof AxiosError && err.response?.status === 422) {
          setError("Укажите ФИО полностью, как в справочнике пользователей 1С");
        } else if (err instanceof AxiosError && err.response?.status === 401) {
          setError("Неверный пароль или нет доступа к 1С");
        } else if (err instanceof AxiosError && err.response?.status === 503) {
          setError("1С или OData недоступны. Проверьте ФИО и подключение к серверу.");
        } else if (err instanceof AxiosError && err.response?.status === 404) {
          setError("Сервис 1С недоступен. Проверьте VITE_ONEC_API_SERVER и proxy /onec-api");
        } else {
          setError(getCorporateLoginError(err));
        }
      } else {
        setError(requiresPasswordChange ? "Не удалось изменить пароль" : "Неверный email или пароль");
      }
    } finally {
      submitInFlight.current = false;
      setIsSubmitting(false);
    }
  }

  function handleCorporateLogin() {
    setError(null);
    setRequiresPasswordChange(false);
    setIsCorporateMode(true);
  }

  function handlePlatformLogin() {
    setError(null);
    setIsCorporateMode(false);
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <a className={styles.logo} href="/" aria-label="AI Agents Platform">
          <img className={styles.logoImage} src="/platform-logo.png" alt="" width={28} height={28} />
          <span className={styles.logoText}>AI Agents Platform</span>
        </a>
        <nav className={styles.headerNav} aria-label="Вспомогательная навигация">
          <div className={styles.languageMenu}>
            <button
              aria-expanded={isLanguageOpen}
              aria-haspopup="listbox"
              className={styles.headerButton}
              type="button"
              onClick={() => setIsLanguageOpen((value) => !value)}
            >
              <Globe aria-hidden="true" className={styles.headerIcon} size={16} strokeWidth={2} />
              {currentLanguage.label}
              <ChevronDown
                aria-hidden="true"
                className={`${styles.headerChevron} ${isLanguageOpen ? styles.chevronOpen : ""}`}
                size={14}
                strokeWidth={2}
              />
            </button>
            {isLanguageOpen && (
              <div className={styles.languageDropdown} role="listbox" aria-label="Выбор языка">
                {languages.map((language) => (
                  <button
                    aria-selected={language.code === selectedLanguage}
                    className={styles.languageOption}
                    key={language.code}
                    role="option"
                    type="button"
                    onClick={() => {
                      setSelectedLanguage(language.code);
                      setIsLanguageOpen(false);
                    }}
                  >
                    <span className={styles.languageBadge}>{language.icon}</span>
                    <span>{language.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <ThemeToggle />
          <span className={styles.headerDivider} aria-hidden="true" />
          <button className={styles.headerButton} type="button">
            <CircleHelp aria-hidden="true" className={styles.headerIcon} size={16} strokeWidth={2} />
            Справка
          </button>
        </nav>
      </header>

      <main className={styles.main}>
        <section className={styles.hero} aria-labelledby="login-hero-title">
          <h1 id="login-hero-title">AI Agents Platform</h1>
          <p className={styles.eyebrow}>Корпоративная платформа для управления ИИ-агентами</p>
          <p className={styles.heroText}>
            Автоматизируйте ключевые бизнес-процессы и повышайте эффективность команды с помощью
            интеллектуальных агентов. Проверка документов, регламентов, ОП, КД/ТД, тендеров и
            производственных процессов в единой платформе.
          </p>

          <div className={styles.featureGrid} aria-label="Ключевые возможности платформы">
            {featureCards.map((card) => (
              <article className={styles.featureCard} key={card.id}>
                <span className={styles.featureIcon}>
                  <img src={card.iconSrc} alt={card.iconAlt} width={64} height={64} />
                </span>
                <div className={styles.featureHead}>
                  {card.highlight ? (
                    <div className={styles.featureMetric}>
                      <span className={styles.featureHighlight}>{card.highlight}</span>
                      <span className={styles.featureSubtitle}>{card.subtitle}</span>
                    </div>
                  ) : (
                    <strong className={styles.featureTitle}>{card.title}</strong>
                  )}
                </div>
                <p className={styles.featureDescription}>
                  {card.description.map((line) => (
                    <span key={line}>{line}</span>
                  ))}
                </p>
              </article>
            ))}
          </div>

          <div className={styles.processMap} aria-label="Пример процесса обработки">
            <svg className={styles.processLines} viewBox="0 0 976 293" aria-hidden="true">
              <path className={styles.blueLine} d="M278 124 C318 124 324 132 356 132" />
              <path className={styles.violetLine} d="M600 108 C660 108 638 46 694 46" />
              <path className={styles.greenLine} d="M600 182 C658 182 640 226 694 226" />
              <path
                className={`${styles.energyLine} ${styles.energyBlue}`}
                d="M278 124 C318 124 324 132 356 132"
                pathLength="100"
              />
              <path
                className={`${styles.energyLine} ${styles.energyViolet}`}
                d="M600 108 C660 108 638 46 694 46"
                pathLength="100"
              />
              <path
                className={`${styles.energyLine} ${styles.energyGreen}`}
                d="M600 182 C658 182 640 226 694 226"
                pathLength="100"
              />
              <circle className={styles.blueDot} cx="278" cy="124" r="5.5" />
              <circle className={styles.blueDot} cx="356" cy="132" r="5.5" />
              <circle className={styles.violetDot} cx="600" cy="108" r="5.5" />
              <circle className={styles.violetDot} cx="694" cy="46" r="6.5" />
              <circle className={styles.greenDot} cx="600" cy="182" r="5.5" />
              <circle className={styles.greenDot} cx="694" cy="226" r="6.5" />
            </svg>

            <article className={`${styles.workflowCard} ${styles.documentCard}`}>
              <span className={`${styles.workflowIcon} ${styles.workflowBlue}`}>
                <FileText size={26} strokeWidth={1.8} aria-hidden="true" />
              </span>
              <div className={styles.workflowContent}>
                <h3>Проверка документов</h3>
                <span className={styles.statusDone}>Завершено</span>
              </div>
              <div className={styles.workflowProgress}>
                <span className={styles.progressBar} style={{ width: "98%" }} />
              </div>
              <strong className={styles.percent}>98%</strong>
            </article>

            <article className={`${styles.workflowCard} ${styles.agentCard}`}>
              <div className={styles.agentHeader}>
                <span className={`${styles.workflowIcon} ${styles.workflowBlue}`}>
                  <BrainCircuit size={30} strokeWidth={1.8} aria-hidden="true" />
                </span>
                <div>
                  <h3>ИИ-агент</h3>
                  <p>Анализ и обработка</p>
                </div>
              </div>
              <ul className={styles.agentSteps}>
                {agentSteps.map((step) => (
                  <li key={step}>
                    <span>
                      <Check size={16} strokeWidth={2.2} aria-hidden="true" />
                    </span>
                    {step}
                  </li>
                ))}
              </ul>
            </article>

            <article className={`${styles.workflowCard} ${styles.regulationCard}`}>
              <span className={`${styles.workflowIcon} ${styles.workflowViolet}`}>
                <Scale size={27} strokeWidth={1.8} aria-hidden="true" />
              </span>
              <div className={styles.workflowContent}>
                <h3>Проверка регламентов</h3>
                <span className={styles.statusWork}>В работе</span>
              </div>
              <div className={styles.workflowProgress}>
                <span className={styles.progressBar} style={{ width: "64%" }} />
              </div>
              <strong className={styles.percent}>64%</strong>
            </article>

            <article className={`${styles.workflowCard} ${styles.tenderCard}`}>
              <span className={`${styles.workflowIcon} ${styles.workflowGreen}`}>
                <BarChart3 size={28} strokeWidth={1.8} aria-hidden="true" />
              </span>
              <div className={styles.workflowContent}>
                <h3>Анализ тендеров</h3>
                <span className={styles.statusDone}>Завершено</span>
              </div>
              <div className={styles.workflowProgress}>
                <span className={styles.progressBar} style={{ width: "100%" }} />
              </div>
              <strong className={styles.percent}>100%</strong>
            </article>
          </div>
        </section>

        <section className={styles.loginPanel} aria-labelledby="login-form-title">
          <form className={styles.form} onSubmit={handleSubmit} noValidate>
            <h2 className={styles.formTitle} id="login-form-title">
              {isCorporateMode ? "Вход через 1С" : "Вход в систему"}
            </h2>

            {isCorporateMode ? (
              <label className={styles.field} htmlFor={fioId}>
                <span>ФИО как в 1С</span>
                <div className={styles.inputShell}>
                  <UserRound className={styles.fieldIcon} size={18} strokeWidth={2.1} aria-hidden="true" />
                  <input
                    id={fioId}
                    autoComplete="name"
                    placeholder="Иванов Иван Иванович"
                    type="text"
                    value={fio}
                    onChange={(event) => setFio(event.target.value)}
                    required
                  />
                </div>
              </label>
            ) : (
              <label className={styles.field} htmlFor={emailId}>
                <span>Email или корпоративный логин</span>
                <div className={styles.inputShell}>
                  <UserRound className={styles.fieldIcon} size={18} strokeWidth={2.1} aria-hidden="true" />
                  <input
                    id={emailId}
                    autoComplete="email"
                    inputMode="email"
                    placeholder="name@company.com или логин"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    required
                  />
                </div>
              </label>
            )}

            <label className={styles.field} htmlFor={passwordId}>
              <span>Пароль</span>
              <div className={styles.inputShell}>
                <LockKeyhole className={styles.fieldIcon} size={18} strokeWidth={2.1} aria-hidden="true" />
                <input
                  id={passwordId}
                  autoComplete="current-password"
                  placeholder="Введите пароль"
                  type={isPasswordVisible ? "text" : "password"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                />
                <button
                  aria-label={isPasswordVisible ? "Скрыть пароль" : "Показать пароль"}
                  className={styles.iconButton}
                  type="button"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => setIsPasswordVisible((value) => !value)}
                >
                  {isPasswordVisible ? (
                    <EyeOff size={20} strokeWidth={2.25} aria-hidden="true" />
                  ) : (
                    <Eye size={20} strokeWidth={2.25} aria-hidden="true" />
                  )}
                </button>
              </div>
            </label>

            {!isCorporateMode && requiresPasswordChange && (
              <>
                <label className={styles.field} htmlFor={newPasswordId}>
                  <span>Новый пароль</span>
                  <div className={styles.inputShell}>
                    <LockKeyhole className={styles.fieldIcon} size={18} strokeWidth={2.1} aria-hidden="true" />
                    <input
                      id={newPasswordId}
                      autoComplete="new-password"
                      minLength={8}
                      placeholder="Задайте новый пароль"
                      type={isPasswordVisible ? "text" : "password"}
                      value={newPassword}
                      onChange={(event) => setNewPassword(event.target.value)}
                      required
                    />
                  </div>
                </label>

                <label className={styles.field} htmlFor={confirmPasswordId}>
                  <span>Повторите новый пароль</span>
                  <div className={styles.inputShell}>
                    <LockKeyhole className={styles.fieldIcon} size={18} strokeWidth={2.1} aria-hidden="true" />
                    <input
                      id={confirmPasswordId}
                      autoComplete="new-password"
                      minLength={8}
                      placeholder="Повторите новый пароль"
                      type={isPasswordVisible ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(event) => setConfirmPassword(event.target.value)}
                      required
                    />
                  </div>
                </label>
              </>
            )}

            {!isCorporateMode && (
              <div className={styles.formMeta}>
                <label className={styles.checkbox}>
                  <input
                    checked={rememberMe}
                    type="checkbox"
                    onChange={(event) => setRememberMe(event.target.checked)}
                  />
                  <span>Запомнить меня</span>
                </label>
              </div>
            )}

            {isCorporateMode && isSubmitting ? (
              <p className={styles.corporateHint}>
                Выполняем вход. Задачи из 1С загрузятся отдельным запросом после входа.
              </p>
            ) : null}

            {error && <div className={styles.errorMessage}>{error}</div>}

            <button className={styles.submitButton} disabled={isSubmitting} type="submit">
              {isSubmitting
                ? isCorporateMode
                  ? "Входим..."
                  : "Входим..."
                : isCorporateMode
                  ? "Войти через корпоративную учётную запись"
                  : requiresPasswordChange
                    ? "Сохранить пароль и войти"
                    : "Войти"}
            </button>

            {!isCorporateMode ? (
              <>
                <a className={styles.forgotLink} href="/login">
                  Забыли пароль?
                </a>

                <div className={styles.separator}>
                  <span>или</span>
                </div>

                <button className={styles.ssoButton} type="button" onClick={handleCorporateLogin}>
                  <svg className={styles.ssoIcon} viewBox="0 0 18 18" aria-hidden="true">
                    <path d="M3 16h12" />
                    <path d="M4.25 6.25h9.5v9.75h-9.5z" />
                    <path d="M6.15 3.6h5.7v2.65h-5.7z" />
                    <path d="M7 7.9v6.2M9 7.9v6.2M11 7.9v6.2" />
                  </svg>
                  <span>Войти через корпоративную учетную запись</span>
                </button>
              </>
            ) : (
              <button className={styles.forgotLink} type="button" onClick={handlePlatformLogin}>
                Вернуться к входу по email
              </button>
            )}

            <p className={styles.supportText}>
              Нет доступа? Обратитесь к администратору платформы
            </p>
          </form>
        </section>
      </main>
    </div>
  );
}
