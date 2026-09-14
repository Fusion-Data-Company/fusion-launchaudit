DO $$ BEGIN
 ALTER TABLE users ADD COLUMN IF NOT EXISTS property_scope_mode text;
 ALTER TABLE users ADD COLUMN IF NOT EXISTS property_scope_revision integer NOT NULL DEFAULT 0;
 UPDATE users u SET property_scope_mode=CASE WHEN role='owner' THEN 'all'
   WHEN EXISTS(SELECT 1 FROM property_access p WHERE p.user_id=u.id) THEN 'restricted' ELSE 'all' END
 WHERE property_scope_mode IS NULL;
 ALTER TABLE users ALTER COLUMN property_scope_mode SET DEFAULT 'restricted';
 ALTER TABLE users ALTER COLUMN property_scope_mode SET NOT NULL;
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conname='users_property_scope_mode_check' AND conrelid='users'::regclass) THEN
  ALTER TABLE users ADD CONSTRAINT users_property_scope_mode_check CHECK(property_scope_mode IN ('all','restricted'));
 END IF;
 END $$;CREATE OR REPLACE FUNCTION rentdesk_set_property_scope(p_actor integer,p_account integer,p_target integer,p_mode text,p_ids integer[],p_revision integer)
 RETURNS integer LANGUAGE plpgsql AS $$
 DECLARE target users%ROWTYPE; next_revision integer;
 BEGIN
  PERFORM 1 FROM users WHERE id=p_actor AND account_id=p_account AND role='owner' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Only the account owner can manage property access' USING ERRCODE='P0001'; END IF;
  SELECT * INTO target FROM users WHERE id=p_target AND account_id=p_account FOR UPDATE;
  IF NOT FOUND OR target.role='owner' THEN RAISE EXCEPTION 'Choose a manager or viewer on this account' USING ERRCODE='P0001'; END IF;
  IF target.property_scope_revision<>p_revision THEN RAISE EXCEPTION 'Access changed. Reload settings before saving' USING ERRCODE='P0001'; END IF;
  IF p_mode NOT IN ('all','restricted') OR p_ids IS NULL OR cardinality(p_ids)>10000 THEN RAISE EXCEPTION 'Invalid property access selection' USING ERRCODE='P0001'; END IF;
  IF EXISTS(SELECT 1 FROM unnest(p_ids) n WHERE n IS NULL OR NOT EXISTS(SELECT 1 FROM buildings b WHERE b.id=n AND b.account_id=p_account)) THEN
   RAISE EXCEPTION 'A selected building is not on this account' USING ERRCODE='P0001'; END IF;
  DELETE FROM property_access WHERE user_id=p_target;
  IF p_mode='restricted' THEN
   INSERT INTO property_access(user_id,building_id) SELECT p_target,n FROM (SELECT DISTINCT unnest(p_ids) n) selected;
  END IF;
  UPDATE users SET property_scope_mode=p_mode,property_scope_revision=property_scope_revision+1 WHERE id=p_target RETURNING property_scope_revision INTO next_revision;
  INSERT INTO audit_log(account_id,user_id,actor,action,detail) VALUES(p_account,p_actor,'Account owner','user.property_scope',json_build_object('userId',p_target,'mode',p_mode,'buildingIds',CASE WHEN p_mode='all' THEN ARRAY[]::integer[] ELSE p_ids END,'revision',next_revision)::text);
  RETURN next_revision;
 END $$