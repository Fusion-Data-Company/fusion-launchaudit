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

## A2. MOBILE — Additional MASTG test enumeration (gap-fill, raw 06)

> Strict provenance: when asked to map MASTG-TEST IDs to PLATFORM/CODE/RESILIENCE/NETWORK, Perplexity
> confirmed **only one** explicit MASVS↔MASTG-TEST mapping (PLATFORM → MASTG-TEST-0029); it stated the
> official MASTG test-index does not publish populated MASVS-mapping columns for CODE/RESILIENCE/NETWORK
> and **refused to guess** the category mapping. The rows below reflect that: row 100 is a confirmed
> mapping; rows 101–105 are real MASTG-TEST IDs + titles that exist in the official index but whose
> MASVS-category linkage is NOT officially confirmed — marked **[category UNCONFIRMED]** accordingly.

| # | Test / Check | What it verifies | Subcategory | Standard ref | Source | Source URL | Automatable by LaunchAudit? |
|---|---|---|---|---|---|---|---|
| 100 | Sensitive functionality exposure through IPC | App's IPC (exported components, bound services) doesn't expose sensitive functionality to other apps without authorization | PLATFORM | MASTG-TEST-0029 (→ MASVS-PLATFORM-1) | OWASP MASTG | https://mas.owasp.org/MASTG-TEST-0029/ | Partial — static + device analysis |
| 101 | Testing for debugging symbols | Release binary doesn't ship debugging symbols | CODE [category UNCONFIRMED] | MASTG-TEST-0040 (title only; MASVS link not official) | OWASP MASTG index | https://mas.owasp.org/MASTG/tests/ | Partial — binary analysis |
| 102 | Insufficient obfuscation of security-relevant code | Security-relevant Java/Kotlin code is sufficiently obfuscated | CODE/RESILIENCE [category UNCONFIRMED] | MASTG-TEST-0368 (title only; MASVS link not official) | OWASP MASTG index | https://mas.owasp.org/MASTG/tests/ | Partial — binary analysis |
| 103 | Testing root detection | App detects rooted/jailbroken devices | RESILIENCE [category UNCONFIRMED] | MASTG-TEST-0045 (title only; MASVS link not official) | OWASP MASTG index | https://mas.owasp.org/MASTG/tests/ | No — runtime defense check |
| 104 | Testing anti-debugging detection | App detects/resists attached debuggers | RESILIENCE [category UNCONFIRMED] | MASTG-TEST-0046 (title only; MASVS link not official) | OWASP MASTG index | https://mas.owasp.org/MASTG/tests/ | No — runtime defense check |
| 105 | Testing reverse-engineering tools detection | App detects reverse-engineering/instrumentation tools (e.g. Frida) | RESILIENCE [category UNCONFIRMED] | MASTG-TEST-0048 (title only; MASVS link not official) | OWASP MASTG index | https://mas.owasp.org/MASTG/tests/ | No — runtime defense check |

---

## B2. AI / VOICE — Prompt-injection & jailbreak taxonomy (gap-fill, raw 07)

> Standard refs use **MITRE ATLAS** technique IDs (authoritative) + **OWASP GenAI LLM01** (authoritative).
> Named jailbreak sub-classes (role-play/DAN, obfuscation, payload-splitting, adversarial-suffix,
> instruction-manipulation) come from **vendor/research taxonomies** (Arthur, Promptfoo, CrowdStrike,
> Pangea) — these are recognized but NOT standards; they are labeled as such in the Source column.

| # | Test / Check | What it verifies | Subcategory | Standard ref | Source | Source URL | Automatable by LaunchAudit? |
|---|---|---|---|---|---|---|---|
| 106 | Direct prompt-injection technique | User input directly overrides system/developer instructions | Prompt Injection | MITRE ATLAS AML.T0051.000; OWASP LLM01 | MITRE ATLAS / OWASP GenAI | https://genai.owasp.org/llmrisk/llm01-prompt-injection/ | Yes — probe suite |
| 107 | Indirect prompt-injection technique | Malicious instructions embedded in fetched external content (web/PDF/email/RAG) alter behavior | Prompt Injection | MITRE ATLAS AML.T0051.001; OWASP LLM01 | MITRE ATLAS / OWASP GenAI | https://genai.owasp.org/llmrisk/llm01-prompt-injection/ | Yes — seeded-content tests |
| 108 | Direct jailbreak injection | Attempts to make model disregard safety protocols | Jailbreak | MITRE ATLAS AML.T0054 | MITRE ATLAS / OWASP GenAI | https://genai.owasp.org/llmrisk/llm01-prompt-injection/ | Yes — jailbreak probe suite |
| 109 | Role-play / persona jailbreak (DAN, "act as") | Model persuaded to adopt rule-exempt persona then respond unsafely | Jailbreak | AML.T0054 (ATLAS); Arthur 5-class taxonomy (vendor) | Arthur (vendor taxonomy) | https://www.arthur.ai/blog/from-jailbreaks-to-gibberish-understanding-the-different-types-of-prompt-injections | Yes — probe suite |
| 110 | Hypothetical / story / counterfactual jailbreak | Harmful request cast as fiction/"for research" bypasses safeguards | Jailbreak | AML.T0054 (ATLAS); Promptfoo (tool) | Promptfoo (tool docs) | https://www.promptfoo.dev/blog/jailbreaking-vs-prompt-injection/ | Yes — probe suite |
| 111 | Gradual / many-step / multi-turn jailbreak | Guardrails fail when attacker builds up incrementally over turns | Jailbreak | AML.T0054 (ATLAS); Promptfoo (tool) | Promptfoo (tool docs) | https://www.promptfoo.dev/blog/jailbreaking-vs-prompt-injection/ | Partial — multi-turn harness |
| 112 | Obfuscation / encoding jailbreak | Base64/leetspeak/emoji/ASCII-art encoding bypasses content filters | Jailbreak | AML.T0051.000/AML.T0054 (ATLAS); Arthur (vendor) | Arthur (vendor taxonomy) | https://www.arthur.ai/blog/from-jailbreaks-to-gibberish-understanding-the-different-types-of-prompt-injections | Yes — probe suite |
| 113 | Payload-splitting injection | Malicious instruction split into benign segments recombined by model | Prompt Injection | AML.T0051.000 (ATLAS); Arthur (vendor) | Arthur (vendor taxonomy) | https://www.arthur.ai/blog/from-jailbreaks-to-gibberish-understanding-the-different-types-of-prompt-injections | Yes — probe suite |
| 114 | Adversarial-suffix attack | Appended gibberish/adversarial strings break refusal mechanisms (transferable) | Jailbreak | AML.T0054 (ATLAS); Arthur (vendor) | Arthur (vendor taxonomy) | https://www.arthur.ai/blog/from-jailbreaks-to-gibberish-understanding-the-different-types-of-prompt-injections | Partial — needs suffix dataset |
| 115 | Refusal-suppression / instruction manipulation | "Ignore prior instructions"/"always reply" overrides system policy | Prompt Injection | AML.T0051.000 (ATLAS); OWASP LLM01 | MITRE ATLAS / OWASP GenAI | https://genai.owasp.org/llmrisk/llm01-prompt-injection/ | Yes — probe suite |
| 116 | System-prompt extraction / prompt leakage | Hidden system prompt/tool schemas exposed via prompting | Prompt Injection | AML.T0051.x (ATLAS); OWASP LLM01/LLM07 | MITRE ATLAS / OWASP GenAI | https://genai.owasp.org/llmrisk/llm01-prompt-injection/ | Yes — exfil probe suite |
| 117 | Tool-use / function-calling injection | Injection causes misuse of tools/plugins/APIs (exfiltration, arbitrary requests) | Prompt Injection | AML.T0051.000/.001 (ATLAS); OWASP LLM01 | MITRE ATLAS / OWASP GenAI | https://genai.owasp.org/llmrisk/llm01-prompt-injection/ | Partial — needs tool harness |
| 118 | Indirect injection via RAG/browsing/multi-chain | Injected content survives chain transformations and triggers tool/data misuse | Prompt Injection | AML.T0051.001 (ATLAS); OWASP LLM01 | MITRE ATLAS / OWASP GenAI | https://genai.owasp.org/llmrisk/llm01-prompt-injection/ | Yes — seeded-content tests |

---

## B3. AI / VOICE — RAG / hallucination / groundedness evaluation metrics (gap-fill, raw 08)

> Source-type is explicit: **RAGAS, DeepEval, TruLens = open-source evaluation frameworks** (not
> standards bodies). The RAG triad is defined by TruLens. These are the recognized de-facto methods;
> there is no ISO/NIST-level standard for these specific metrics yet.

| # | Test / Check | What it verifies | Subcategory | Standard ref | Source | Source URL | Automatable by LaunchAudit? |
|---|---|---|---|---|---|---|---|
| 119 | Faithfulness | Answer is supported by retrieved context (fraction of claims supported); no hallucination beyond context | RAG eval | RAGAS / DeepEval metric (OSS framework) | RAGAS docs | https://docs.ragas.io/en/stable/concepts/metrics/available_metrics/ | Yes — LLM-as-judge harness |
| 120 | Answer relevance | Final answer addresses the user's question | RAG eval | RAGAS / DeepEval metric (OSS framework) | DeepEval docs | https://deepeval.com/docs/metrics-contextual-precision | Yes |
| 121 | Context precision | Retrieved chunks relevant + well-ranked (relevant chunks ranked higher) | RAG eval | RAGAS Context Precision (OSS framework) | RAGAS docs | https://docs.ragas.io/en/stable/concepts/metrics/available_metrics/context_precision/ | Yes |
| 122 | Context recall | Retrieved context contains the info needed to answer (vs gold chunks) | RAG eval | RAGAS / DeepEval metric (OSS framework) | DeepEval docs | https://deepeval.com/docs/metrics-contextual-precision | Yes |
| 123 | Context relevance | Retrieved context is relevant to the query (chunk-level judge) | RAG eval | TruLens RAG-triad / RAGAS (OSS framework) | DeepEval docs | https://deepeval.com/docs/metrics-contextual-precision | Yes |
| 124 | Groundedness | Answer anchored in source context, sentence/claim-level support | RAG eval | TruLens RAG-triad (OSS framework) | TruLens (via DeepEval/RAGAS docs) | https://docs.ragas.io/en/stable/concepts/metrics/available_metrics/ | Yes — LLM-as-judge harness |
| 125 | RAG triad coverage | All 3 dimensions (context relevance + groundedness + answer relevance) evaluated together | RAG eval | TruLens RAG triad (OSS framework) | TruLens (RAG triad) | https://docs.ragas.io/en/stable/concepts/metrics/available_metrics/ | Yes |
| 126 | Factual consistency / hallucination rate | Output facts consistent with source; hallucination rate = unsupported/contradictory claim rate (often 1 − faithfulness) | RAG eval | Measurement concept (RAGAS/DeepEval impl, OSS) | RAGAS docs | https://docs.ragas.io/en/stable/concepts/metrics/available_metrics/ | Yes |
| 127 | Citation accuracy | Cited source actually supports the cited claim; citations placed correctly | RAG eval | Research/eval practice (attribution) | RAGAS docs (groundedness/citation support) | https://docs.ragas.io/en/stable/concepts/metrics/available_metrics/ | Partial — needs labeled set |

---

## B4. AI / VOICE — NIST AI RMF testable controls (gap-fill, raw 09)

> Standard refs: **NIST AI 100-1** (AI RMF 1.0) and **NIST AI 600-1** (Generative AI Profile). NIST
> defines risk *characteristics*, not pass/fail test specs — these rows are the testable checks a tester
> derives from each characteristic (per raw 09's tester-oriented mapping).

| # | Test / Check | What it verifies | Subcategory | Standard ref | Source | Source URL | Automatable by LaunchAudit? |
|---|---|---|---|---|---|---|---|
| 128 | Validity check | Model does what it's supposed to on representative tasks / golden datasets | MEASURE | NIST AI 100-1; AI 600-1 | NIST AI RMF | https://www.nist.gov/itl/ai-risk-management-framework | Partial — needs golden set |
| 129 | Reliability check | Consistency across repeated runs, seeds, paraphrases, sessions, versions | MEASURE | NIST AI 100-1 | NIST AI RMF | https://www.nist.gov/itl/ai-risk-management-framework | Yes — repeatability harness |
| 130 | Robustness check | Performance under noisy/adversarial/OOD inputs, context truncation, tool failures | MEASURE | NIST AI 100-1; AI 600-1 | NIST AI RMF | https://www.nist.gov/itl/ai-risk-management-framework | Yes — perturbation suite |
| 131 | Safety check | Harmful content, unsafe advice, policy violations, refusal behavior on disallowed prompts | MEASURE | NIST AI 100-1; AI 600-1 | NIST AI RMF | https://www.nist.gov/itl/ai-risk-management-framework | Yes — safety probe suite |
| 132 | Security/resilience check | Prompt-injection, jailbreak, exfiltration, tool-abuse + recovery under failure | MEASURE | NIST AI 100-1; AI 600-1 | NIST AI RMF | https://www.nist.gov/itl/ai-risk-management-framework | Yes — maps to rows 56-118 |
| 133 | Accountability/transparency check | Logging, output→input traceability, model/version attribution, auditability | MEASURE/GOVERN | NIST AI 100-1; AI 600-1 | NIST AI RMF | https://www.nist.gov/itl/ai-risk-management-framework | Partial — log/audit review |
| 134 | Explainability/interpretability check | System exposes usable rationale/citations/decision traces matching actual behavior | MEASURE | NIST AI 100-1; AI 600-1 | NIST AI RMF | https://www.nist.gov/itl/ai-risk-management-framework | Partial |
| 135 | Privacy check | Memorization, sensitive-data leakage, training-data regurgitation, prompt-based PII exposure | MEASURE | NIST AI 100-1; AI 600-1 | NIST AI RMF | https://www.nist.gov/itl/ai-risk-management-framework | Yes — leakage probe suite |
| 136 | Fairness/bias check | Subgroup performance disparity, error-rate disparity, toxic stereotyping across demographics | MEASURE | NIST AI 100-1; AI 600-1 | NIST AI RMF | https://www.nist.gov/itl/ai-risk-management-framework | Partial — needs labeled subgroups |

---

## B5. AI / VOICE — Conversational & voice-agent QA (gap-fill, raw 10)

> **Weak standardization — read source labels carefully.** The QA *categories* below come mostly from
> industry/vendor QA frameworks (WebRTC.Ventures, Hamming AI, Braintrust, Bluejay, Zendesk, Cekura) —
> recognized practice, NOT standards. The only formal standards in this section are the **metrics**:
> **WER** (de-facto ASR standard via NIST/academic benchmarks) and **MOS / objective speech-quality**
> (ITU-T P.800 for MOS, ITU-T P.862/POLQA). Category rows are tagged `[industry framework]`; metric
> rows carry the real standard. ElevenLabs ConvAI-specific config checks remain in [MODEL-SUGGESTED].

| # | Test / Check | What it verifies | Subcategory | Standard ref | Source | Source URL | Automatable by LaunchAudit? |
|---|---|---|---|---|---|---|---|
| 137 | Intent recognition accuracy | Utterance → correct intent/slots/action (robust to paraphrase, accents, noise) | Voice/NLU [industry framework] | Intent accuracy / precision-recall-F1 / slot-F1 | Braintrust (industry) | https://www.braintrust.dev/articles/how-to-evaluate-voice-agents | Yes — labeled test set |
| 138 | Dialog & state management | Agent maintains dialog state, branching, clarification, repair across turns | Voice/dialog [industry framework] | Task-completion rate / avg turns / state-consistency | Hamming AI (industry) | https://hamming.ai/resources/guide-to-ai-voice-agents-quality-assurance | Partial — conversation sim |
| 139 | Turn-taking | Agent starts promptly after user, doesn't talk over user, detects end-of-utterance | Voice/timing [industry framework] | Turn-transition delay / overlap rate / turn-taking error rate | WebRTC.Ventures (industry) | https://webrtc.ventures/2026/03/qa-testing-for-ai-voice-agents/ | Partial — RTC test harness |
| 140 | Barge-in / interruption handling | User interrupts mid-TTS → agent stops, processes, responds appropriately | Voice/timing [industry framework] | Barge-in detection rate / barge-in success rate | WebRTC.Ventures (industry) | https://webrtc.ventures/2026/03/qa-testing-for-ai-voice-agents/ | Partial — RTC test harness |
| 141 | Latency / response time | End-to-end (user end-of-speech → agent start-of-speech) + per-component (ASR/LLM/TTS) | Voice/perf [industry framework] | End-to-end latency / time-to-first-audio / P95-P99 | WebRTC.Ventures (industry) | https://webrtc.ventures/2026/03/qa-testing-for-ai-voice-agents/ | Yes — timing instrumentation |
| 142 | ASR accuracy (WER) | Speech-to-text quality under noise/accents/channels | Voice/ASR | **WER = (S+D+I)/N** (de-facto ASR standard; NIST/academic) | NIST/academic WER (via Braintrust) | https://www.braintrust.dev/articles/how-to-evaluate-voice-agents | Yes — WER vs reference transcripts |
| 143 | TTS quality | Naturalness/intelligibility/prosody/voice consistency of synthesized speech | Voice/TTS | **MOS (ITU-T P.800)**; objective: ITU-T P.862/POLQA | ITU-T (standards) via Braintrust | https://www.braintrust.dev/articles/how-to-evaluate-voice-agents | Partial — MOS needs human raters |
| 144 | Function / tool-call correctness | Correct tool chosen, args reflect user intent, tool-failure handling | Voice/tools [industry framework] | Tool-selection accuracy / argument-correctness rate | Hamming AI (industry) | https://hamming.ai/resources/guide-to-ai-voice-agents-quality-assurance | Partial — needs tool harness |
| 145 | Fallback / error handling | Graceful recovery on ASR/NLU/tool failure: clarify, partial answer, escalate | Voice/robustness [industry framework] | Fallback rate / recovery-success rate / escalation rate | Zendesk (vendor) | https://www.zendesk.com/service/quality-assurance/qa-for-ai-agents/ | Partial — scenario sim |
| 146 | Context retention across turns | Agent remembers/uses prior-turn context (referents, slots, preferences) | Voice/dialog [industry framework] | Context carry-over accuracy / coreference accuracy / multi-turn success | Hamming AI (industry) | https://hamming.ai/resources/guide-to-ai-voice-agents-quality-assurance | Partial — multi-turn sim |
| 147 | Multilingual & cross-lingual handling | ASR/intent/TTS parity per language; code-switch robustness; language-ID | Voice/i18n [industry framework] | WER/CER per language / intent accuracy per language / multilingual MOS | Bluejay (industry) | https://getbluejay.ai/resources/voice-agent-qa-vs-software-testing | Partial — per-locale test sets |

---

## Unverified / needs a source

Gap-fill passes (raws 06–10) sourced most of what was previously unverified: RAGAS/DeepEval/TruLens
are now in section B3 (with official docs URLs), the prompt-injection/jailbreak taxonomy is in B2 (MITRE
ATLAS + OWASP + vendor taxonomies), NIST AI RMF testable controls are in B4, and voice-agent QA is in
B5. The items still genuinely unsourced or sourced only to weaker references:

- **garak** (NVIDIA LLM vuln/jailbreak scanner) — named in raw 07's narrative as a recognized tool but its
  detailed probe taxonomy "is in tool docs/code rather than a formal taxonomy paper"; **no official garak
  docs URL was returned** in any pass. [UNVERIFIED — needs official garak/NVIDIA docs URL before cataloguing]
- **CrowdStrike (185+ technique) / Pangea (145+ technique) / Lasso prompt-injection taxonomies** — real,
  cited in raw 07, but they are vendor catalogs, not standards. Usable as coverage checklists; not added
  as individual test rows. [vendor taxonomy — confirm desired granularity before expanding]
- **TruLens RAG-triad** — the triad concept is well-attested (raw 08), but the rows above cite the RAGAS/
  DeepEval docs URLs for the metric definitions; a direct TruLens docs URL was not captured. [partial-source]
- **Voice-agent QA categories (rows 137–141, 144–147)** — sourced to industry/vendor QA frameworks
  (WebRTC.Ventures, Hamming AI, Braintrust, Bluejay, Zendesk), explicitly **not standards bodies**. Only
  the WER and MOS/POLQA *metrics* (rows 142–143) rest on real standards (NIST/academic WER; ITU-T P.800/
  P.862). Treat the category rows as recognized-practice, not normative.

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
- `docs/research/test-catalog/raw/mobile-ai-06.json` — MASTG test-ID enumeration for PLATFORM/CODE/RESILIENCE/NETWORK (only PLATFORM→MASTG-TEST-0029 confirmed; others title-only, category unconfirmed) — HTTP 200
- `docs/research/test-catalog/raw/mobile-ai-07.json` — Prompt-injection & jailbreak taxonomy (MITRE ATLAS AML.T0051.x / AML.T0054, OWASP LLM01, vendor taxonomies Arthur/Promptfoo/CrowdStrike/Pangea) — HTTP 200
- `docs/research/test-catalog/raw/mobile-ai-08.json` — RAG/hallucination/groundedness eval metrics (RAGAS/DeepEval/TruLens OSS frameworks; faithfulness, answer/context relevance, precision/recall, groundedness, RAG triad, citation accuracy) — HTTP 200
- `docs/research/test-catalog/raw/mobile-ai-09.json` — NIST AI RMF testable controls (NIST AI 100-1 + Generative AI Profile AI 600-1; 9 characteristics × GOVERN/MAP/MEASURE/MANAGE) — HTTP 200
- `docs/research/test-catalog/raw/mobile-ai-10.json` — Conversational/voice-agent QA categories (11 categories; industry frameworks + WER/MOS/POLQA standards) — HTTP 200

### Still open (re-run when prioritized)
- **ElevenLabs ConvAI official-docs pass** — still NOT run; the [MODEL-SUGGESTED] ConvAI config checks above remain model-knowledge only, unconfirmed against https://elevenlabs.io/docs.
- **garak official docs** — needed to source the one remaining [UNVERIFIED] tool taxonomy.
