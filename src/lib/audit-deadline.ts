import type { DeepGrade } from './deep-grade.ts';
import type { GradeFailure } from './instant-grade.ts';

/** Leave runtime headroom to persist the outcome before Vercel ends the request. */
export async function withAuditDeadline(
  audit: Promise<DeepGrade | GradeFailure>,
  milliseconds = 220_000,
): Promise<DeepGrade | GradeFailure> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      audit,
      new Promise<GradeFailure>((resolve) => {
        timer = setTimeout(() => resolve({ ok: false, status: 503,
          error: 'Audit exceeded its execution window. The order remains queued for automatic retry.' }), milliseconds);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
