# Mobile + AI / Voice-Agent — Test Catalog

Domain split into two sections: **A. Mobile application testing** and **B. AI / LLM / Voice-agent testing**.
Provenance-first per `RESEARCH-PROTOCOL.md`: every main-table row carries a Source + URL that
appeared in a Perplexity answer or its citations, plus a standard reference where one exists.

> Provenance note for this domain (read first): AI/voice testing has **weaker standardization**
> than web/API. The OWASP Top 10 for LLM Applications 2025 and NIST AI RMF are real, published, and
> citable. But RAG-eval frameworks (RAGAS, DeepEval), prompt-injection scanners (garak, Promptfoo),
> and ElevenLabs ConvAI configuration checks were **not successfully sourced** in this run — the
> Perplexity call covering them (raw 06) failed mid-flight (network reset), and a planned ElevenLabs
> official-docs call never ran, both because the host machine's disk filled (ENOSPC) and blocked all
> further shell/curl calls. Those items are therefore listed under "Unverified / needs a source" and
> "[MODEL-SUGGESTED — confirm]" rather than the main tables. Mobile (MASVS/MASTG) is fully sourced.

---

## A. MOBILE — Sources used

| Source | Org | Covers | URL |
|---|---|---|---|
| OWASP MASVS (Mobile Application Security Verification Standard) v2 | OWASP Mobile Application Security (MAS) | Baseline mobile security + privacy requirements (the "what"); 8 control groups | https://mas.owasp.org/MASVS/ |
| OWASP MASTG (Mobile Application Security Testing Guide) | OWASP MAS | Test cases + techniques mapped to MASVS (the "how"); `MASTG-TEST-xxxx` IDs | https://mas.owasp.org/MASTG/ |
| OWASP MASWE (Mobile Application Security Weakness Enumeration) | OWASP MAS | Mobile-specific weakness list bridging MASVS ↔ MASTG; basis for MAS Testing Profiles | https://mas.owasp.org/ |
| OWASP Mobile Application Security Checklist | OWASP MAS | Machine/auditor-friendly mapping of MASVS controls → MASTG test IDs (+ profiles) | https://mas.owasp.org/checklists/ |
| OWASP MASVS-STORAGE checklist | OWASP MAS | Full enumerated MASTG-TEST IDs for the STORAGE category | https://mas.owasp.org/checklists/MASVS-STORAGE/ |
| React Native — Testing docs | Meta (React Native) | Functional/quality test tooling for RN apps (Jest, Detox, RNTL) | https://reactnative.dev/docs/testing-overview |
| Expo — Testing docs | Expo | Testing guidance for Expo/RN apps (Jest, RNTL, E2E) | https://docs.expo.dev/ |
| Android Developer — Testing docs | Google | Unit/instrumentation/UI/perf/accessibility testing + permissions | https://developer.android.com/training/testing |
| Apple — Xcode Testing (XCTest/XCUITest) | Apple | iOS unit/UI/performance testing + privacy/permissions | https://developer.apple.com/documentation/xctest |

---

## A. MOBILE — Tests

> STORAGE rows carry exact `MASTG-TEST-xxxx` IDs taken from the official MASVS-STORAGE checklist
> (raw 03). For CRYPTO / AUTH / NETWORK, the official checklist pages with per-test `MASTG-TEST-xxxx`
> IDs were **not exposed** in the retrieved material, so those rows use the authoritative legacy
> requirement IDs (`MSTG-CRYPTO-x`, `MSTG-AUTH-x`, `MSTG-NETWORK-x`) and point to the MASTG category
> root — the specific numeric test-page IDs are flagged where unverified, to avoid fabricating codes.

| # | Test / Check | What it verifies | Subcategory | Standard ref | Source | Source URL | Automatable by LaunchAudit? |
|---|---|---|---|---|---|---|---|
| 1 | App securely stores sensitive data | Sensitive data at rest is stored in proper locations with proper protection | STORAGE | MASVS-STORAGE-1 | OWASP MASVS | https://mas.owasp.org/MASVS/05-MASVS-STORAGE/ | Partial — needs device/static analysis |
| 2 | App prevents leakage of sensitive data | No unnecessary/insecure exposure via logs, backups, UI, 3rd-party SDKs | STORAGE | MASVS-STORAGE-2 | OWASP MASVS | https://mas.owasp.org/MASVS/05-MASVS-STORAGE/ | Partial |
| 3 | Test local storage for sensitive data | How app stores data locally (internal/external/db/prefs) + protection | STORAGE | MASTG-TEST-0001 | OWASP MASTG | https://mas.owasp.org/MASTG/tests/android/MASVS-STORAGE/MASTG-TEST-0001/ | No — requires instrumented device |
| 4 | Test the device-access-security policy | App leverages device-level lock/encryption when storing locally | STORAGE | MASTG-TEST-0012 | OWASP MASTG checklist | https://mas.owasp.org/checklists/MASVS-STORAGE/ | No — device test |
| 5 | Test local data storage (platform variant) | Sensitive info not improperly/unprotected stored (iOS variant of #3) | STORAGE | MASTG-TEST-0052 | OWASP MASTG checklist | https://mas.owasp.org/checklists/MASVS-STORAGE/ | No — device test |
| 6 | Keyboard cache disabled for text input fields | Password/PIN fields disable keyboard cache/autocomplete history | STORAGE | MASTG-TEST-0006 | OWASP MASTG checklist | https://mas.owasp.org/checklists/MASVS-STORAGE/ | No — device test |
| 7 | Test logs for sensitive data | App logs contain no credentials/tokens/PII/secrets | STORAGE | MASTG-TEST-0003 | OWASP MASTG checklist | https://mas.owasp.org/checklists/MASVS-STORAGE/ | Partial — log capture + scan |
| 8 | Test memory for sensitive data | Secrets not lingering in process memory in insecure form | STORAGE | MASTG-TEST-0011 | OWASP MASTG checklist | https://mas.owasp.org/checklists/MASVS-STORAGE/ | No — runtime memory analysis |
| 9 | Sensitive data shared with 3rd parties via notifications | Notifications/lock-screen don't expose sensitive content | STORAGE | MASTG-TEST-0005 | OWASP MASTG checklist | https://mas.owasp.org/checklists/MASVS-STORAGE/ | No — device test |
| 10 | Test backups for sensitive data | OS/cloud/app backups don't insecurely include sensitive data | STORAGE | MASTG-TEST-0009 | OWASP MASTG checklist | https://mas.owasp.org/checklists/MASVS-STORAGE/ | Partial — config check |
| 11 | Sensitive data shared via embedded services | Analytics/ads/crash SDKs don't inadvertently receive PII/tokens | STORAGE | MASTG-TEST-0004 | OWASP MASTG checklist | https://mas.owasp.org/checklists/MASVS-STORAGE/ | Partial — traffic + SDK analysis |
| 12 | Check logs for sensitive data (iOS) | Platform logging doesn't contain sensitive info | STORAGE | MASTG-TEST-0053 | OWASP MASTG checklist | https://mas.owasp.org/checklists/MASVS-STORAGE/ | Partial |
| 13 | Test backups for sensitive data (iOS) | iOS device/cloud backups don't expose sensitive data | STORAGE | MASTG-TEST-0058 | OWASP MASTG checklist | https://mas.owasp.org/checklists/MASVS-STORAGE/ | Partial |
| 14 | Test memory for sensitive data (iOS) | No lingering secrets in iOS process memory | STORAGE | MASTG-TEST-0060 | OWASP MASTG checklist | https://mas.owasp.org/checklists/MASVS-STORAGE/ | No — runtime |
| 15 | Find sensitive data in keyboard cache (iOS) | iOS keyboard cache doesn't store sensitive typed input | STORAGE | MASTG-TEST-0055 | OWASP MASTG checklist | https://mas.owasp.org/checklists/MASVS-STORAGE/ | No — device test |
| 16 | Sensitive data shared with 3rd parties (iOS) | iOS 3rd-party integrations don't unintentionally disclose data | STORAGE | MASTG-TEST-0054 | OWASP MASTG checklist | https://mas.owasp.org/checklists/MASVS-STORAGE/ | Partial |
| 17 | No hardcoded symmetric keys as sole encryption | App doesn't rely on client-side hardcoded keys; uses key management | CRYPTO | MSTG-CRYPTO-1 | OWASP MASTG (legacy req ID) | https://mas.owasp.org/MASTG/ | Partial — static analysis |
| 18 | Uses proven crypto primitive implementations | Standard vetted crypto libs, not homegrown crypto | CRYPTO | MSTG-CRYPTO-2 | OWASP MASTG (legacy req ID) | https://mas.owasp.org/MASTG/ | Partial — static analysis |
| 19 | Appropriate crypto primitives + secure parameters | Correct algorithm/keysize/mode/padding per use case | CRYPTO | MSTG-CRYPTO-3 | OWASP MASTG (legacy req ID) | https://mas.owasp.org/MASTG/ | Partial |
| 20 | No deprecated crypto protocols/algorithms | No MD5/SHA-1-for-integrity/RC4/deprecated ciphersuites | CRYPTO | MSTG-CRYPTO-4 | OWASP MASTG (legacy req ID) | https://mas.owasp.org/MASTG/ | Partial — static analysis |
| 21 | No crypto-key reuse across purposes | Key separation between encryption/MAC/KDF | CRYPTO | MSTG-CRYPTO-5 | OWASP MASTG (legacy req ID) | https://mas.owasp.org/MASTG/ | Partial |
| 22 | All random values from secure RNG | CSPRNG used for keys/IVs/nonces/tokens | CRYPTO | MSTG-CRYPTO-6 | OWASP MASTG (legacy req ID) | https://mas.owasp.org/MASTG/ | Partial — static analysis |
| 23 | Remote endpoint performs authentication | Backend enforces auth, not client-only | AUTH | MSTG-AUTH-1 | OWASP MASTG (legacy req ID) | https://mas.owasp.org/MASTG/ | Partial — API test |
| 24 | Random session identifiers (stateful sessions) | Strong unpredictable session IDs; no repeated credential transmission | AUTH | MSTG-AUTH-2 | OWASP MASTG (legacy req ID) | https://mas.owasp.org/MASTG/ | Partial |
| 25 | Securely signed tokens (stateless auth) | JWT/token auth signed with secure algorithm + verified | AUTH | MSTG-AUTH-3 | OWASP MASTG (legacy req ID) | https://mas.owasp.org/MASTG/ | Yes — token inspection |
| 26 | Session terminated on logout | Server- and client-side session invalidation on logout | AUTH | MSTG-AUTH-4 | OWASP MASTG (legacy req ID) | https://mas.owasp.org/MASTG/ | Partial — API test |
| 27 | Password policy enforced at endpoint | Backend enforces complexity/length policy | AUTH | MSTG-AUTH-5 | OWASP MASTG (legacy req ID) | https://mas.owasp.org/MASTG/ | Partial — API test |
| 28 | Anti-brute-force on credential submission | Rate-limiting/lockout/CAPTCHA against excessive attempts | AUTH | MSTG-AUTH-6 | OWASP MASTG (legacy req ID) | https://mas.owasp.org/MASTG/ | Partial — API test |
| 29 | Data encrypted on network via TLS, used consistently | All sensitive traffic uses TLS, no plaintext fallback | NETWORK | MSTG-NETWORK-1 | OWASP MASTG (legacy req ID) | https://mas.owasp.org/MASTG/ | Yes — traffic analysis |
| 30 | TLS settings follow best practices | Correct protocol versions, ciphers, cert validation | NETWORK | MSTG-NETWORK-2 | OWASP MASTG (legacy req ID) | https://mas.owasp.org/MASTG/ | Yes — TLS scan |
| 31 | X.509 certificate verification of endpoint | Trust-chain to trusted CA; reject invalid/self-signed unless pinned | NETWORK | MSTG-NETWORK-3 | OWASP MASTG (legacy req ID) | https://mas.owasp.org/MASTG/ | Partial — device + traffic |
| 32 | Minimum necessary privileges/permissions | App requests only required permissions; not over-privileged | PLATFORM | MASVS-PLATFORM-1 | OWASP MASVS | https://mas.owasp.org/MASVS/09-MASVS-PLATFORM/ | Yes — manifest/plist scan |
| 33 | Platform security features used correctly | Secure IPC/intents/Keychain/Keystore/secure storage APIs | PLATFORM | MASVS-PLATFORM-2 | OWASP MASVS | https://mas.owasp.org/MASVS/09-MASVS-PLATFORM/ | Partial — static analysis |
| 34 | Sensitive data/functionality isolated from other apps | Proper file modes, exported components, content providers, sandbox | PLATFORM | MASVS-PLATFORM-3 | OWASP MASVS | https://mas.owasp.org/MASVS/09-MASVS-PLATFORM/ | Partial — static analysis |
| 35 | Secure coding for data handling/input processing | Avoids injection/insecure deserialization/unsafe WebView/reflection | CODE | MASVS-CODE-1 | OWASP MASVS | https://mas.owasp.org/MASVS/10-MASVS-CODE/ | Partial — SAST |
| 36 | Secure error handling and logging | Exceptions/crashes/logs don't leak sensitive info/internals | CODE | MASVS-CODE-2 | OWASP MASVS | https://mas.owasp.org/MASVS/10-MASVS-CODE/ | Partial — SAST + log scan |
| 37 | Third-party components up-to-date and managed | No known-vulnerable libs; trusted sources; updates applied | CODE | MASVS-CODE-3 | OWASP MASVS | https://mas.owasp.org/MASVS/10-MASVS-CODE/ | Yes — SCA on lockfile |
| 38 | Platform integrity validation | Detects rooted/jailbroken/emulated/virtualized environments | RESILIENCE | MASVS-RESILIENCE-1 | OWASP MASVS | https://mas.owasp.org/MASVS/11-MASVS-RESILIENCE/ | No — runtime defense check |
| 39 | Anti-tampering mechanisms | Package signature checks + integrity validation of code/resources | RESILIENCE | MASVS-RESILIENCE-2 | OWASP MASVS | https://mas.owasp.org/MASVS/11-MASVS-RESILIENCE/ | No — runtime defense check |
| 40 | Anti-static-analysis mechanisms | Obfuscation, symbol stripping, control-flow obf, string encryption | RESILIENCE | MASVS-RESILIENCE-3 | OWASP MASVS | https://mas.owasp.org/MASVS/11-MASVS-RESILIENCE/ | Partial — binary analysis |
| 41 | Anti-dynamic-analysis techniques | Debugger/anti-hooking/anti-instrumentation (e.g. Frida) detection | RESILIENCE | MASVS-RESILIENCE-4 | OWASP MASVS | https://mas.owasp.org/MASVS/11-MASVS-RESILIENCE/ | No — runtime defense check |
| 42 | Minimum necessary personal-data collection | App collects only minimum PII required for functionality | PRIVACY | MASVS-PRIVACY-1 | OWASP MASVS | https://mas.owasp.org/MASVS/12-MASVS-PRIVACY/ | Partial |
| 43 | Personal data handled/stored with protections | Minimization, access control, secure storage + sharing of PII | PRIVACY | MASVS-PRIVACY-2 | OWASP MASVS | https://mas.owasp.org/MASVS/12-MASVS-PRIVACY/ | Partial |
| 44 | User transparency and control over data | Clear notices, consent, manage/delete-data options | PRIVACY | MASVS-PRIVACY-3 | OWASP MASVS | https://mas.owasp.org/MASVS/12-MASVS-PRIVACY/ | Partial — policy + UI review |
| 45 | Unit & component tests (RN) | Logic/components/hooks correctness via Jest | QUALITY | (RN docs — no MASVS ID) | React Native Testing | https://reactnative.dev/docs/testing-overview | Yes — CI test runner |
| 46 | Snapshot tests (RN) | Component render output stability | QUALITY | (RN docs) | React Native Testing | https://reactnative.dev/docs/testing-overview | Yes — CI |
| 47 | End-to-end / UI tests (RN, Detox) | Interaction flows on real/simulated device | QUALITY/UX | (RN docs) | React Native Testing | https://reactnative.dev/docs/testing-overview | Partial — device farm |
| 48 | Component/accessibility tests (Expo, RNTL) | Component behavior + accessibility via React Native Testing Library | QUALITY/UX | (Expo docs) | Expo Testing | https://docs.expo.dev/ | Yes — CI |
| 49 | Android unit + instrumentation/UI tests | JUnit/Robolectric + Espresso/UI Automator | QUALITY | (Android docs) | Android Testing | https://developer.android.com/training/testing | Yes — CI/emulator |
| 50 | Android performance/benchmark tests | Benchmarking + profiling of app performance | PERFORMANCE | (Android docs) | Android Testing | https://developer.android.com/training/testing | Partial — device |
| 51 | Android runtime-permission behavior | Runtime/dangerous/privacy-sensitive permission handling | PERMISSIONS | (Android docs) | Android Permissions | https://developer.android.com/guide/topics/permissions/overview | Partial — manifest + runtime |
| 52 | iOS unit tests (XCTest) | Unit-level correctness | QUALITY | (Apple docs) | Apple XCTest | https://developer.apple.com/documentation/xctest | Yes — CI/Xcode |
| 53 | iOS UI tests (XCUITest) | UI interaction flows | QUALITY/UX | (Apple docs) | Apple XCTest | https://developer.apple.com/documentation/xctest | Partial — simulator |
| 54 | iOS performance tests (XCTest metrics/Instruments) | Performance measurement + profiling | PERFORMANCE | (Apple docs) | Apple XCTest | https://developer.apple.com/documentation/xctest | Partial |
| 55 | iOS privacy/permission authorization behavior | Correct authorization requests + behavior when denied | PERMISSIONS | (Apple docs) | Apple Privacy & Permissions | https://developer.apple.com/documentation/uikit/protecting_the_user_s_privacy | Partial — plist + runtime |

---

## B. AI / LLM / VOICE-AGENT — Sources used

| Source | Org | Covers | URL |
|---|---|---|---|
| OWASP Top 10 for LLM Applications 2025 | OWASP Gen AI Security Project | 10 LLM-app risk categories LLM01–LLM10 + per-risk testing guidance | https://owasp.org/www-project-top-10-for-large-language-model-applications/ |
| OWASP Top 10 for LLM Applications 2025 (PDF) | OWASP | Canonical 2025 list + descriptions | https://owasp.org/www-project-top-10-for-large-language-model-applications/assets/PDF/OWASP-Top-10-for-LLMs-v2025.pdf |
| NIST AI Risk Management Framework (AI RMF 1.0 / NIST AI 100-1) | NIST | Risk taxonomy: GOVERN/MAP/MEASURE/MANAGE; validity, robustness, safety, security, privacy, explainability | https://www.nist.gov/itl/ai-risk-management-framework |
| NIST AI RMF 1.0 PDF (AI 100-1) | NIST | Full framework text | https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.100-1.pdf |
| MITRE ATLAS | MITRE | Adversary tactics/techniques/case-studies for AI/ML systems (ATT&CK-style) | https://atlas.mitre.org/ |
| OWASP LLM AI Security & Governance Guide | OWASP | LLM threat modeling, secure-design, governance, testing considerations | https://owasp.org/www-project-llm-ai-security-governance/ |
| OWASP AI Exchange | OWASP | Curated GenAI/LLM security testing + red-teaming content | https://ai.owasp.org/ |
| ISO/IEC 23894:2023 | ISO/IEC JTC 1/SC 42 | AI risk-management guidance (risk-based test strategy) | https://www.iso.org/standard/77304.html |
| ISO/IEC 42001:2023 | ISO/IEC JTC 1/SC 42 | AI management system: validation/verification/monitoring requirements | https://www.iso.org/standard/81230.html |
| EU AI Act (Reg. proposal COM(2021) 206) | European Union | High-risk AI: accuracy, robustness, cybersecurity testing/validation requirements | https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:52021PC0206 |

> Note on category names: OWASP published two slightly different LLM Top-10 framings across raws.
> This catalog uses the **authoritative 2025 list from the OWASP 2025 PDF / project page** (raw 05),
> which is: LLM01 Prompt Injection, LLM02 Sensitive Information Disclosure, LLM03 Supply Chain,
> LLM04 Data and Model Poisoning, LLM05 Improper Output Handling, LLM06 Excessive Agency,
> LLM07 System Prompt Leakage, LLM08 Vector and Embedding Weaknesses, LLM09 Misinformation,
> LLM10 Unbounded Consumption.

---

## B. AI / LLM / VOICE-AGENT — Tests

| # | Test / Check | What it verifies | Subcategory | Standard ref | Source | Source URL | Automatable by LaunchAudit? |
|---|---|---|---|---|---|---|---|
| 56 | Direct prompt-injection red-team probes | "Ignore previous instructions"/role-override don't bypass guardrails or reveal system info | Prompt Injection | LLM01:2025 | OWASP Top 10 for LLM Apps 2025 | https://owasp.org/www-project-top-10-for-large-language-model-applications/ | Yes — automated probe suite |
| 57 | Indirect prompt injection via untrusted content | Hidden instructions in docs/web/email treated as data, not executed | Prompt Injection | LLM01:2025 | OWASP Top 10 for LLM Apps 2025 | https://owasp.org/www-project-top-10-for-large-language-model-applications/ | Yes — seeded-content tests |
| 58 | Instruction-hierarchy / override testing | System/developer messages retain precedence over user override attempts | Prompt Injection | LLM01:2025 | OWASP Top 10 for LLM Apps 2025 | https://owasp.org/www-project-top-10-for-large-language-model-applications/ | Yes |
| 59 | Tool/agent abuse checks | Unauthorized tool actions blocked / require human approval (least privilege) | Prompt Injection | LLM01:2025 | OWASP Top 10 for LLM Apps 2025 | https://owasp.org/www-project-top-10-for-large-language-model-applications/ | Partial — needs tool harness |
| 60 | Training-data memorization probes | Model refuses to emit memorized secrets/PII from training data | Sensitive Info Disclosure | LLM02:2025 | OWASP Top 10 for LLM Apps 2025 | https://owasp.org/www-project-top-10-for-large-language-model-applications/ | Yes — extraction probes |
| 61 | Context/RAG leakage testing | Seeded sensitive markers in vector store not disclosed to unauthorized users | Sensitive Info Disclosure | LLM02:2025 | OWASP Top 10 for LLM Apps 2025 | https://owasp.org/www-project-top-10-for-large-language-model-applications/ | Yes — seeded-token tests |
| 62 | Cross-tenant / access-control tests | LLM cannot access/describe another tenant's data | Sensitive Info Disclosure | LLM02:2025 | OWASP Top 10 for LLM Apps 2025 | https://owasp.org/www-project-top-10-for-large-language-model-applications/ | Yes — multi-account probes |
| 63 | Log/telemetry/error-message leakage checks | Error outputs never include stack traces/secrets/internal IDs | Sensitive Info Disclosure | LLM02:2025 | OWASP Top 10 for LLM Apps 2025 | https://owasp.org/www-project-top-10-for-large-language-model-applications/ | Yes — error-path probes |
| 64 | Model provenance & integrity verification | Model artifacts signed/verified; tampered/swapped model detected | Supply Chain | LLM03:2025 | OWASP Top 10 for LLM Apps 2025 | https://owasp.org/www-project-top-10-for-large-language-model-applications/ | Partial — deploy config check |
| 65 | Third-party plugin/tool trust assessment | Plugin endpoints tested (auth/input-val/output-sanitation); malicious plugin response handled safely | Supply Chain | LLM03:2025 | OWASP Top 10 for LLM Apps 2025 | https://owasp.org/www-project-top-10-for-large-language-model-applications/ | Partial |
| 66 | Dependency / model inventory checks | Inventory of models/datasets/plugins/libs exists; vulnerable deps detected | Supply Chain | LLM03:2025 | OWASP Top 10 for LLM Apps 2025 | https://owasp.org/www-project-top-10-for-large-language-model-applications/ | Yes — SCA |
| 67 | Outbound-call routing control tests | LLM tool calls restricted to approved domains; arbitrary URLs blocked + logged | Supply Chain | LLM03:2025 | OWASP Top 10 for LLM Apps 2025 | https://owasp.org/www-project-top-10-for-large-language-model-applications/ | Partial |
| 68 | Poisoned-content injection on RAG/vector store | Crafted malicious docs retrieved are treated as untrusted, not instructions | Data/Model Poisoning | LLM04:2025 | OWASP Top 10 for LLM Apps 2025 | https://owasp.org/www-project-top-10-for-large-language-model-applications/ | Yes — seeded-doc tests |
| 69 | Backdoor trigger checks | Rare-token/string triggers don't produce abnormal/unsafe behavior | Data/Model Poisoning | LLM04:2025 | OWASP Top 10 for LLM Apps 2025 | https://owasp.org/www-project-top-10-for-large-language-model-applications/ | Partial |
| 70 | Training/fine-tuning data ingestion validation | Harmful/policy-violating training examples flagged/rejected | Data/Model Poisoning | LLM04:2025 | OWASP Top 10 for LLM Apps 2025 | https://owasp.org/www-project-top-10-for-large-language-model-applications/ | Partial — pipeline check |
| 71 | Model-drift / behavior-change monitoring | Canary probes detect shifts toward previously-banned outputs | Data/Model Poisoning | LLM04:2025 | OWASP Top 10 for LLM Apps 2025 | https://owasp.org/www-project-top-10-for-large-language-model-applications/ | Yes — scheduled canaries |
| 72 | Injection into downstream systems (code/SQL/shell) | LLM-produced SQL/shell/JS not executed blindly; validated/escaped | Improper Output Handling | LLM05:2025 | OWASP Top 10 for LLM Apps 2025 | https://owasp.org/www-project-top-10-for-large-language-model-applications/ | Yes — output-injection probes |
| 73 | XSS / HTML-injection checks | LLM output rendered with HTML encoding/CSP; no script execution | Improper Output Handling | LLM05:2025 | OWASP Top 10 for LLM Apps 2025 | https://owasp.org/www-project-top-10-for-large-language-model-applications/ | Yes — render-path tests |
| 74 | Command/template injection + deserialization tests | Malicious payloads in templates/CLIs/config filtered before use | Improper Output Handling | LLM05:2025 | OWASP Top 10 for LLM Apps 2025 | https://owasp.org/www-project-top-10-for-large-language-model-applications/ | Partial |
| 75 | Content-policy enforcement testing | Disallowed-category prompts blocked/redacted by classifiers/post-processing | Improper Output Handling | LLM05:2025 | OWASP Top 10 for LLM Apps 2025 | https://owasp.org/www-project-top-10-for-large-language-model-applications/ | Yes — policy probe suite |
| 76 | High-risk action simulation | Funds-transfer/access-change/mass-email/delete require human approval | Excessive Agency | LLM06:2025 | OWASP Top 10 for LLM Apps 2025 | https://owasp.org/www-project-top-10-for-large-language-model-applications/ | Partial — needs tool harness |
| 77 | Tool permission-boundary tests | Out-of-scope tool requests (read /etc/passwd, internal metadata) blocked | Excessive Agency | LLM06:2025 | OWASP Top 10 for LLM Apps 2025 | https://owasp.org/www-project-top-10-for-large-language-model-applications/ | Partial |
| 78 | Autonomous-loop / self-calling checks | Iteration/resource caps enforced; destructive loops halted/monitored | Excessive Agency | LLM06:2025 | OWASP Top 10 for LLM Apps 2025 | https://owasp.org/www-project-top-10-for-large-language-model-applications/ | Partial |
| 79 | Privilege-escalation attempts | No automatic self-escalation; role/permission changes external + audited | Excessive Agency | LLM06:2025 | OWASP Top 10 for LLM Apps 2025 | https://owasp.org/www-project-top-10-for-large-language-model-applications/ | Partial |
| 80 | Direct system-prompt exfiltration tests | "Print your system prompt" refused; preamble concealed | System Prompt Leakage | LLM07:2025 | OWASP Top 10 for LLM Apps 2025 | https://owasp.org/www-project-top-10-for-large-language-model-applications/ | Yes — exfil probe suite |
| 81 | Indirect leakage via paraphrasing | "Explain your rules" doesn't reproduce sensitive internal policy/secrets | System Prompt Leakage | LLM07:2025 | OWASP Top 10 for LLM Apps 2025 | https://owasp.org/www-project-top-10-for-large-language-model-applications/ | Yes |
| 82 | Error/log/message reflection tests | Errors/debug don't reveal system prompts/internal IDs/hidden messages | System Prompt Leakage | LLM07:2025 | OWASP Top 10 for LLM Apps 2025 | https://owasp.org/www-project-top-10-for-large-language-model-applications/ | Yes |
| 83 | Context-assembly leakage checks | "Show all instructions/context" returns only user-visible content | System Prompt Leakage | LLM07:2025 | OWASP Top 10 for LLM Apps 2025 | https://owasp.org/www-project-top-10-for-large-language-model-applications/ | Yes |
| 84 | Cross-tenant vector-access tests | Retrieval enforces tenant boundaries; no other-tenant docs returned | Vector & Embedding Weaknesses | LLM08:2025 | OWASP Top 10 for LLM Apps 2025 | https://owasp.org/www-project-top-10-for-large-language-model-applications/ | Yes — seeded multi-tenant tests |
| 85 | Embedding-based data-exfiltration probes | Synthetic secrets in embeddings not retrievable/inferable | Vector & Embedding Weaknesses | LLM08:2025 | OWASP Top 10 for LLM Apps 2025 | https://owasp.org/www-project-top-10-for-large-language-model-applications/ | Yes |
| 86 | Poisoned-vector document tests | Retrieved malicious docs labeled untrusted; not treated as system instructions | Vector & Embedding Weaknesses | LLM08:2025 | OWASP Top 10 for LLM Apps 2025 | https://owasp.org/www-project-top-10-for-large-language-model-applications/ | Yes |
| 87 | Embedding API abuse & rate tests | Input-size + rate limits on embedding service; no info-leak in errors | Vector & Embedding Weaknesses | LLM08:2025 | OWASP Top 10 for LLM Apps 2025 | https://owasp.org/www-project-top-10-for-large-language-model-applications/ | Yes — load/probe tests |
| 88 | Groundedness / RAG-triad checks | Responses grounded in retrieved sources; uncertainty flagged (context-relevance, groundedness, answer-relevance) | Misinformation | LLM09:2025 | OWASP Top 10 for LLM Apps 2025 | https://owasp.org/www-project-top-10-for-large-language-model-applications/ | Partial — needs ground-truth set |
| 89 | High-impact-domain hallucination tests | Safety-critical (medical/legal/financial) edge cases defer/warn appropriately | Misinformation | LLM09:2025 | OWASP Top 10 for LLM Apps 2025 | https://owasp.org/www-project-top-10-for-large-language-model-applications/ | Partial |
| 90 | Output labeling and provenance checks | Responses labeled AI-generated; citations validated or marked unverified | Misinformation | LLM09:2025 | OWASP Top 10 for LLM Apps 2025 | https://owasp.org/www-project-top-10-for-large-language-model-applications/ | Yes — UI/API inspection |
| 91 | Overreliance-guard tests | App doesn't delegate policy/access-control decisions solely to LLM output | Misinformation | LLM09:2025 | OWASP Top 10 for LLM Apps 2025 | https://owasp.org/www-project-top-10-for-large-language-model-applications/ | Partial |
| 92 | Token/length abuse tests | Limits on input size/output tokens/request duration enforce cutoffs | Unbounded Consumption | LLM10:2025 | OWASP Top 10 for LLM Apps 2025 | https://owasp.org/www-project-top-10-for-large-language-model-applications/ | Yes — load probes |
| 93 | Request rate & concurrency stress tests | Rate-limiting (429s/queueing) + graceful degradation under load | Unbounded Consumption | LLM10:2025 | OWASP Top 10 for LLM Apps 2025 | https://owasp.org/www-project-top-10-for-large-language-model-applications/ | Yes |
| 94 | Tool/external-resource consumption tests | Caps on tool invocations per request; recursive/large ops blocked | Unbounded Consumption | LLM10:2025 | OWASP Top 10 for LLM Apps 2025 | https://owasp.org/www-project-top-10-for-large-language-model-applications/ | Partial |
| 95 | Cost/quota enforcement checks | Per-account token/budget quotas enforced; excess rejected without cross-tenant impact | Unbounded Consumption | LLM10:2025 | OWASP Top 10 for LLM Apps 2025 | https://owasp.org/www-project-top-10-for-large-language-model-applications/ | Yes |
| 96 | MEASURE-function risk evaluation coverage | Validity, reliability, robustness, safety, security/resilience, explainability, privacy are measured | AI risk taxonomy | NIST AI RMF 1.0 (AI 100-1), MEASURE | NIST AI RMF | https://www.nist.gov/itl/ai-risk-management-framework | Partial — governance/coverage check |
| 97 | Adversarial test plan vs ATLAS techniques | Red-team coverage of data poisoning, model theft/extraction, evasion, prompt manipulation, exfiltration via outputs | AI threat taxonomy | MITRE ATLAS | MITRE ATLAS | https://atlas.mitre.org/ | Partial — maps to probes above |
| 98 | AI lifecycle validation/verification/monitoring exists | Documented validation, verification, monitoring, incident handling per AIMS | AI management system | ISO/IEC 42001:2023 | ISO/IEC | https://www.iso.org/standard/81230.html | No — process/audit check |
| 99 | Accuracy/robustness/cybersecurity testing (high-risk AI) | High-risk AI tested + validated for accuracy, robustness, cybersecurity | Regulatory | EU AI Act COM(2021) 206 | European Union | https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:52021PC0206 | No — compliance/process check |

---

## Unverified / needs a source

These were intended for enumeration passes that did NOT complete (raw 06 RAG/jailbreak-eval call
failed with a network reset; an ElevenLabs ConvAI official-docs call never ran). They are real, widely
used in practice, but are listed here because no Perplexity-returned source was captured for them in
this run. **Re-run the Perplexity passes once disk space is restored to source these properly.**

- RAGAS — RAG evaluation metrics (faithfulness, answer relevance, context precision/recall). [UNVERIFIED — needs source URL]
- DeepEval / `trydeepteam` — LLM eval + OWASP-LLM red-teaming test harness. (Appeared as a *citation domain* `trydeepteam.com` in raw 05 search_results but was not described as a test source in the answer body — confirm before cataloguing.) [UNVERIFIED]
- garak — LLM vulnerability/jailbreak scanner (NVIDIA). [UNVERIFIED — needs source]
- Promptfoo — prompt regression + guardrail + RAG-correctness eval. (Appeared as citation domain `promptfoo.dev` in raws 02 & 05; flagged in raw 02 as a de-facto tool, not a standard.) [UNVERIFIED as a test source]
- LangSmith — tracing + eval (correctness/latency/cost/safety). (Citation domain only.) [UNVERIFIED as a test source]
- Conversational-AI / voice-agent functional QA taxonomy (intent accuracy, dialog management, contextual consistency, barge-in/turn-taking, ASR/TTS quality, latency). Raw 02 cited a single vendor blog (Rhesis AI) — **vendor blog, not authoritative**; do not catalogue until a stronger source is found. [UNVERIFIED]

## [MODEL-SUGGESTED — confirm]

The orchestrator explicitly requested ElevenLabs ConvAI agent-configuration checks (tools, system
prompt, webhooks, voice/TTS) cited to ElevenLabs official docs. **That Perplexity call never executed**
(disk blocker). The items below are from model knowledge ONLY and are NOT source-backed — do not put
them in the main table until confirmed against https://elevenlabs.io/docs (ConvAI / Agents Platform):

- ConvAI agent has a non-empty, scoped **system prompt** (persona, guardrails, anti-narration).
- **Tools / `tool_ids`** registered are intended set; no accidental empty array wiping all tools.
- **Webhook tools** point to correct, authenticated endpoints (HMAC/secret), reachable, correct schema.
- **Voice / TTS** model + voice ID set; latency/`flash` model appropriate for real-time.
- **LLM model** + fallback chain configured.
- **Dynamic variables** injected (page/record/user context) for context-awareness.
- **Knowledge base** docs attached and retrievable; RAG grounded to KB.
- **Admin passphrase / privileged-mode** gating works and isn't leakable (ties to LLM07 above).
- First-message / conversation-start config present; no dead-air on call connect.

## Raw evidence

- `docs/research/test-catalog/raw/mobile-ai-01.json` — Mobile sources pass (MASVS/MASTG/MASWE/checklist/ASVS/RN/Expo/Android/iOS) — HTTP 200
- `docs/research/test-catalog/raw/mobile-ai-02.json` — AI/LLM sources pass (OWASP LLM Top 10, NIST AI RMF, MITRE ATLAS, OWASP gov guides, ISO 23894/42001, EU AI Act; also de-facto tools) — HTTP 200
- `docs/research/test-catalog/raw/mobile-ai-03.json` — MASVS/MASTG enumeration: STORAGE (full MASTG-TEST IDs), CRYPTO/AUTH/NETWORK (legacy MSTG IDs, with explicit caveats) — HTTP 200
- `docs/research/test-catalog/raw/mobile-ai-04.json` — MASVS enumeration: PLATFORM/CODE/RESILIENCE/PRIVACY controls + MAS Testing Profiles (L1/L2/R/P) — HTTP 200
- `docs/research/test-catalog/raw/mobile-ai-05.json` — OWASP LLM Top 10 2025 per-item concrete tests (authoritative 2025 names from OWASP PDF) — HTTP 200
- `mobile-ai-06.json` — RAG/hallucination/jailbreak-eval enumeration — **FAILED (network reset, then disk ENOSPC); not saved**
- (planned) ElevenLabs ConvAI official-docs pass — **NEVER RAN (disk ENOSPC blocked all curl calls)**
