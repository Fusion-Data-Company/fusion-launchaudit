BEGIN;
ALTER TABLE paid_audits ADD COLUMN IF NOT EXISTS paid_at timestamptz;
ALTER TABLE paid_audits ADD COLUMN IF NOT EXISTS crm_order_id uuid DEFAULT gen_random_uuid();
CREATE UNIQUE INDEX IF NOT EXISTS paid_audits_crm_id ON paid_audits(crm_order_id);
CREATE TABLE IF NOT EXISTS audit_crm_outbox(id bigserial PRIMARY KEY,order_id uuid NOT NULL,payload jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT clock_timestamp(),acknowledged_at timestamptz,attempts integer NOT NULL DEFAULT 0,next_attempt_at timestamptz NOT NULL DEFAULT now(),lease_until timestamptz,lease_token uuid,last_error text);
CREATE INDEX IF NOT EXISTS audit_crm_due ON audit_crm_outbox(next_attempt_at,id) WHERE acknowledged_at IS NULL;
CREATE OR REPLACE FUNCTION audit_enqueue_order() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE snapshot jsonb;prior jsonb;
BEGIN
snapshot:=jsonb_build_object('product','launchaudit-v1','orderId',NEW.crm_order_id,'buyerId','unclaimed:'||NEW.crm_order_id::text,'plan',NEW.tier,
'status',CASE WHEN NEW.status IN ('refunded','disputed') THEN NEW.status WHEN NEW.status='payment_failed' THEN 'pending' ELSE 'paid' END,
'deliveryStatus',NEW.status,'deliveredAt',CASE WHEN NEW.status='delivered' THEN NEW.completed_at ELSE NULL END,
'amountMinor',NEW.amount_cents,'currency','usd','createdAt',NEW.created_at,'paidAt',CASE WHEN NEW.paid_at IS NULL THEN NULL ELSE GREATEST(NEW.created_at,NEW.paid_at) END,'packagePreparedAt',NULL,'launchStatus','not_applicable');
SELECT payload INTO prior FROM audit_crm_outbox WHERE order_id=NEW.crm_order_id ORDER BY id DESC LIMIT 1;
IF snapshot IS DISTINCT FROM prior THEN INSERT INTO audit_crm_outbox(order_id,payload) VALUES(NEW.crm_order_id,snapshot); END IF; RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS audit_report_order ON paid_audits;
CREATE TRIGGER audit_report_order AFTER INSERT OR UPDATE ON paid_audits FOR EACH ROW EXECUTE FUNCTION audit_enqueue_order();
COMMIT;
