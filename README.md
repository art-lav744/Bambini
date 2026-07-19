# Bambini

[Українська](README.md) · [English](README.en.md)

Bambini — мобільно орієнтований вебзастосунок для пошуку людей і подій поруч. Користувачі можуть створювати події, приєднуватися до них за геолокацією, бачити доступних учасників на MapLibre-карті, додавати друзів і налаштовувати персонажа та тему застосунку.

## Функціонал сайту

### Реєстрація та вхід

- створення акаунта за ім’ям, email і паролем;
- підтвердження email шестизначним кодом, який діє 10 хвилин;
- повторне надсилання коду із 60-секундним обмеженням і захистом від багаторазового неправильного введення;
- вхід через Google Identity Services без додаткового email-коду;
- серверні bearer-сесії, захищені сторінки та вихід з акаунта.

### Карта та геолокація

- інтерактивна MapLibre-карта з автоматичним центруванням на поточній позиції;
- відображення користувачів за їхніми реальними координатами без прив’язування позначок до екрана;
- окремі згортані фільтри людей: нікого, лише друзів або всіх доступних користувачів;
- окремі згортані фільтри подій: жодної, події користувача або всі доступні події;
- фільтрація подій за заготовленими тегами;
- popup користувача з аватаром, маскотом, статусом дружби та дією «Додати в друзі»;
- popup події з назвою, описом, датою, приватністю та кнопками перегляду або приєднання поруч;
- учасники, які фізично перебувають біля події, розміщуються навколо її позначки; друзям надається пріоритет, а надлишок показується лічильником;
- позначки подій плавно масштабуються та приховуються на надто віддаленому масштабі;
- запам’ятовування останньої позиції та масштабу карти;
- оновлення геолокації лише під час активного використання застосунку.

### Події

- створення до трьох власних подій на користувача;
- назва, опис, початок і завершення, одна точка на карті, зображення до 2 МБ та стиль позначки;
- необов’язкове обмеження від 1 до 50 учасників;
- до п’яти заготовлених тегів на одну подію;
- три рівні доступу: публічна, лише для друзів і приватна;
- приєднання за кодом події або через доступну публічну подію;
- перевірка геозони перед приєднанням до публічної події з карти;
- окремі списки власних, дружніх і публічних подій;
- сортування за відстанню, відображення відстані та фільтр за тегами;
- сторінка деталей із датою, описом, тегами, приватністю та списком учасників;
- побудова маршруту до точки події через Google Maps;
- приєднання, вихід із події та перегляд доступних учасників на карті;
- додавання учасника в друзі безпосередньо зі сторінки події;
- організатор може редагувати дані й точку події, видаляти учасників або всю подію;
- панель деталей можна згорнути свайпом униз і повернути свайпом угору;
- учасники отримують внутрішні сповіщення про редагування або видалення події.

### Друзі

- унікальний восьмисимвольний код друга для кожного користувача;
- надсилання запиту за кодом або безпосередньо з карти й події;
- прийняття та відхилення вхідних запитів;
- перегляд і скасування вихідних запитів;
- видалення користувача зі списку друзів через власне діалогове вікно підтвердження;
- індикатор доступності геолокації та часу її останнього оновлення.

### Профіль і приватність

- зміна імені та фотографії профілю;
- видалення фотографії й обмеження завантаження до 2 МБ;
- перегляд і копіювання публічного коду друга;
- три режими видимості геолокації: ніхто, друзі або всі;
- перемикання інтерфейсу між українською та англійською зі збереженням вибору на пристрої;
- попередній перегляд поточного маскота;
- перехід до налаштування стилю та вихід з акаунта.

### Маскот, теми та досягнення

- конструктор маскота зі скіном, аксесуаром, одягом і фоном;
- порожні варіанти одягу й аксесуара для базового маскота без речей;
- скін дельфіна працює як окремий завершений образ і не поєднується з екіпіруванням;
- шість тем інтерфейсу: dark, blue, green, red, sunset і neon;
- частина косметики відкривається за досягнення в подіях, друзях і активності користувача;
- біля заблокованої косметики показано вимогу, поточний прогрес і залишок до відкриття;
- обрана тема й конструкція маскота зберігаються в профілі користувача;
- маскот відображається в профілі та popup користувача на карті.

### Додатково

- адаптивний інтерфейс для телефона і комп’ютера;
- SVG-іконки, власні діалоги підтвердження та повідомлення про успішні або помилкові операції;
- production-збірка frontend і API можуть працювати з одного FastAPI-сервера;
- можливість публікації Bambini як Telegram Mini App через BotFather.

## Технології

| Частина | Стек |
| --- | --- |
| Frontend | React 19, Vite 7, React Router, MapLibre GL |
| Backend | FastAPI, SQLModel, Uvicorn |
| Дані | SQLite та локальне файлове сховище медіа |
| Авторизація | Bearer-сесії, Google Identity Services, email verification |
| Тести | pytest, FastAPI TestClient, Node.js test runner |

## Вимоги

- Windows 10/11 і PowerShell;
- Python 3.11 або новіший;
- Node.js 20.19+ або 22.12+;
- npm;
- доступ до інтернету для карти, Google-входу та надсилання email;
- `cloudflared` — лише для перевірки з телефонів або інших пристроїв через HTTPS.

Перевірити встановлені версії:

```powershell
python --version
node --version
npm --version
```

## Структура проєкту

```text
Bambini/
├── backend/
│   ├── app/                  # FastAPI, моделі та робота з базою
│   │   └── seed.py           # повторювані локальні демо-дані
│   ├── tests/
│   │   ├── unit/             # модульні тести backend
│   │   └── integration/      # інтеграційні API-тести
│   ├── .env.example
│   ├── requirements.txt
│   └── requirements-dev.txt
├── frontend/
│   ├── public/               # логотип і статичні ресурси
│   ├── src/                  # React-застосунок
│   ├── tests/unit/           # модульні тести frontend
│   ├── themes/               # колірні теми
│   └── .env.example
├── start-dev.ps1             # локальна розробка
├── start-android.ps1         # production build + HTTPS Quick Tunnel
├── README.md                 # українська документація
└── README.en.md              # English documentation
```

## Публікація як Telegram Mini App (необов’язково)

Bambini можна опублікувати як Telegram Mini App через [@BotFather](https://t.me/BotFather). Telegram не розгортає frontend або backend самостійно: BotFather зберігає HTTPS-адресу, яку Telegram відкриває у вбудованому WebView.

1. Розгорніть Bambini за постійною HTTPS-адресою або запустіть Cloudflare Quick Tunnel.
2. Відкрийте `@BotFather` і створіть бота командою `/newbot` або виберіть наявного через `/mybots`.
3. Перейдіть до **Bot Settings → Configure Mini App → Enable Mini App**.
4. Вкажіть HTTPS-адресу Bambini, назву, опис, зображення та унікальний short name.
5. Після налаштування застосунок можна відкривати прямим посиланням:

```text
https://t.me/<bot_username>/<short_name>
```

Приклад уже налаштованого Mini App:

**[https://t.me/bambiniapp_bot/bambini](https://t.me/bambiniapp_bot/bambini)**

У цьому прикладі `bambiniapp_bot` — username бота, а `bambini` — short name Mini App. Це посилання наведено як приклад формату, а не як обов’язкова адреса для кожного розгортання.

Якщо використовується Cloudflare Quick Tunnel, після кожної зміни `https://...trycloudflare.com` потрібно оновлювати Web App URL у BotFather. Токен, виданий командою `/newbot`, не додавайте в README, Git або frontend-код. Для простого відкриття Bambini окремий процес Telegram-бота не потрібен; він знадобиться лише для обробки повідомлень або інших можливостей Telegram Bot API.

## Перший запуск

### 1. Створіть локальні файли налаштувань

У корені репозиторію виконайте:

```powershell
Copy-Item backend\.env.example backend\.env
Copy-Item frontend\.env.example frontend\.env
```

Файли `.env` не потрапляють у Git. Не додавайте в репозиторій паролі, Google Client Secret, SMTP App Password або tunnel token.

### 2. Налаштуйте авторизацію

Для реєстрації через email залиште в `backend/.env`:

```dotenv
EMAIL_VERIFICATION_ENABLED=true
```

і заповніть SMTP-параметри. Приклад для Gmail:

```dotenv
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_USE_SSL=true
SMTP_USERNAME=sender@gmail.com
SMTP_PASSWORD=your-16-character-google-app-password
SMTP_FROM_EMAIL=sender@gmail.com
SMTP_FROM_NAME=Bambini
EMAIL_VERIFICATION_SECRET=replace-with-a-long-random-value
```

`SMTP_PASSWORD` має бути саме Google App Password, а не звичайний пароль акаунта і не код із Google Authenticator. Для App Password у Google-акаунті повинна бути ввімкнена двоетапна перевірка.

Якщо SMTP ще не налаштовано, використовуйте підтверджений seed-акаунт із розділу «Демо-дані». Для нього надсилання листа не потрібне. Нові користувачі через email не зможуть завершити реєстрацію, доки SMTP не запрацює. Google-вхід можна залишити вимкненим, не заповнюючи `GOOGLE_CLIENT_ID` і `VITE_GOOGLE_CLIENT_ID`.

### 3. Запустіть режим розробки

```powershell
.\start-dev.ps1
```

Скрипт:

1. створить `backend/.venv`, якщо його ще немає;
2. встановить backend-залежності;
3. запустить FastAPI в окремому PowerShell-вікні;
4. запустить Vite у поточному вікні.

Відкрийте:

- frontend: <http://localhost:5173>;
- API: <http://127.0.0.1:8000>;
- Swagger: <http://127.0.0.1:8000/docs>;
- health check: <http://127.0.0.1:8000/health>.

Зупиніть Vite через `Ctrl+C` і закрийте окреме вікно FastAPI.

## Демо-дані

Після встановлення backend-залежностей можна заповнити локальну базу узгодженими тестовими даними:

```powershell
cd backend
.\.venv\Scripts\python.exe -m app.seed
```

Seed створює:

- п’ять підтверджених демо-користувачів із різними темами та маскотами;
- прийняті, вхідні й вихідні запити в друзі;
- публічну, дружню та приватну події з майбутнім часом;
- учасників і свіжі координати біля публічної події;
- приклади внутрішніх сповіщень та прогресу досягнень.

Основний демо-акаунт:

```text
Email: demo@bambini.local
Пароль: Bambini123!
```

Інші акаунти `*.demo@bambini.local` використовують той самий пароль. Команду можна запускати повторно: вона оновлює лише зарезервовані demo-записи та не створює дублікати. Seed не очищає інші дані, але його не слід запускати у production-базі.

## Ручний запуск

### Backend

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

### Frontend

В іншому PowerShell-вікні:

```powershell
cd frontend
npm ci
npm run dev
```

Vite проксіює `/api` і `/media` на FastAPI, тому для локальної розробки окрему адресу API вказувати не потрібно.

## HTTPS-тестування з телефона або кількох пристроїв

Мобільні браузери дозволяють використовувати геолокацію лише в безпечному HTTPS-контексті. Для тимчасового доступу до Bambini з телефона або іншого комп’ютера використовується Cloudflare Quick Tunnel.

Встановіть `cloudflared` один раз:

```powershell
winget install --id Cloudflare.cloudflared
```

Потім запустіть у корені репозиторію:

```powershell
.\start-android.ps1
```

Скрипт встановить відсутні залежності, збере frontend, запустить FastAPI та виведе тимчасову адресу такого вигляду:

```text
https://random-name.trycloudflare.com
```

Цю саму адресу можна одночасно відкрити на кількох пристроях. Вікна FastAPI і `cloudflared` мають залишатися відкритими протягом тестування. Після зупинки тунелю адреса перестане працювати, а наступний запуск створить нову.

Google-вхід працює лише з адрес, доданих до **Authorized JavaScript origins**. Якщо потрібно перевірити його через Quick Tunnel, додайте поточну `https://...trycloudflare.com` адресу в Google Console. Додавати її до **Authorized redirect URIs** не потрібно. Без цієї дії використовуйте звичайний вхід через email і пароль.

## Налаштування Google-входу

Створіть OAuth Client типу **Web application** у Google Auth Platform. Один і той самий Client ID запишіть у два файли:

`backend/.env`:

```dotenv
GOOGLE_CLIENT_ID=000000000000-example.apps.googleusercontent.com
```

`frontend/.env`:

```dotenv
VITE_GOOGLE_CLIENT_ID=000000000000-example.apps.googleusercontent.com
```

У **Authorized JavaScript origins** додайте потрібні адреси:

```text
http://localhost:5173
http://127.0.0.1:5173
http://localhost:8000
http://127.0.0.1:8000
```

Bambini використовує popup і JavaScript callback, тому **Authorized redirect URIs заповнювати не потрібно**.

Після зміни `frontend/.env` перезапустіть Vite або повторно зберіть frontend. Значення `VITE_*` вбудовуються в JavaScript під час збірки.

## Production-збірка

```powershell
cd frontend
npm ci
npm run check

cd ..\backend
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe -m uvicorn app.main:app --host 0.0.0.0 --port 8000
```

`npm run check` запускає frontend-тести та створює `frontend/dist`. Якщо каталог `dist` існує, FastAPI віддає React Router fallback, API під `/api` і завантажені файли під `/media`.

Для реального розгортання рекомендується HTTPS reverse proxy і постійне сховище для SQLite та медіа.

## Дані та резервні копії

За замовчуванням застосунок створює:

```text
backend/app.db
backend/media/
```

Обидва шляхи виключені з Git. Щоб зберегти користувачів, події, кастомізацію та завантажені зображення, резервуйте і базу, і каталог `media`.

Шляхи можна змінити в `backend/.env`:

```dotenv
DATABASE_URL=sqlite:///C:/absolute/path/to/app.db
MEDIA_ROOT=C:/absolute/path/to/media
```

Не запускайте два незалежні сервери з різними копіями SQLite, якщо очікуєте спільні дані між ними.

## Тести

### Backend

Встановити тестові залежності:

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements-dev.txt
```

Запустити всі backend-тести:

```powershell
.\.venv\Scripts\python.exe -m pytest -q
```

Окремі набори:

```powershell
.\.venv\Scripts\python.exe -m pytest tests\unit -q
.\.venv\Scripts\python.exe -m pytest tests\integration -q
```

Тести використовують тимчасову базу і тимчасовий каталог медіа. Вони не змінюють `backend/app.db` або `backend/media`.

### Frontend

```powershell
cd frontend
npm ci
npm run test:unit
```

Тести та production build разом:

```powershell
npm run check
```

## Основні змінні env

| Змінна | Призначення |
| --- | --- |
| `GOOGLE_CLIENT_ID` | Client ID, який backend використовує для перевірки Google credential |
| `VITE_GOOGLE_CLIENT_ID` | той самий Client ID для Google-кнопки у frontend |
| `EMAIL_VERIFICATION_ENABLED` | вмикає обов’язковий шестизначний email-код |
| `SMTP_HOST`, `SMTP_PORT` | SMTP-сервер і порт |
| `SMTP_USE_SSL` | SSL-з’єднання з SMTP |
| `SMTP_USERNAME`, `SMTP_PASSWORD` | облікові дані поштової скриньки |
| `SMTP_FROM_EMAIL`, `SMTP_FROM_NAME` | відправник листа |
| `EMAIL_VERIFICATION_SECRET` | секрет для HMAC-хешування verification-кодів |
| `CORS_ORIGINS` | дозволені origins, коли frontend і backend запущені окремо |
| `DATABASE_URL` | шлях або URL бази даних |
| `MEDIA_ROOT` | каталог завантажених зображень |
| `VITE_API_URL` | адреса API; за замовчуванням `/api` |

## Типові проблеми

### PowerShell забороняє запуск скриптів

Запустіть лише для поточного процесу:

```powershell
Set-ExecutionPolicy -Scope Process Bypass
```

### Реєстрація повертає `503 Service Unavailable`

SMTP не налаштований або поштовий сервер відхилив вхід. Перевірте `SMTP_*` і переконайтеся, що використовується Google App Password. Для локального перегляду без пошти запустіть seed і увійдіть через `demo@bambini.local` замість створення нового акаунта.

### Повторне надсилання коду повертає `429 Too Many Requests`

Між повторними листами діє 60-секундна затримка. Дочекайтеся завершення таймера.

### Gmail повертає `Application-specific password required`

Створіть Google App Password після ввімкнення двоетапної перевірки. Не використовуйте звичайний пароль Gmail або код Authenticator.

### Google повідомляє про недозволений origin

Додайте точний origin поточної сторінки до **Authorized JavaScript origins**. Origin містить протокол, hostname і порт, але не шлях.

### На телефоні не працює геолокація

Перевірте дозвіл браузера на геолокацію і використовуйте HTTPS. `localhost` є винятком; LAN IP через HTTP не є безпечним контекстом.

### Карта порожня

Перевірте інтернет-з’єднання та чи не блокує мережа завантаження MapLibre/OpenFreeMap ресурсів.
