-- Run offline with a verified backup. Specify both IDs as psql variables.
\set ON_ERROR_STOP on
BEGIN;
LOCK TABLE kyf_accounts, transactions, monthly_budgets, user_profile IN SHARE ROW EXCLUSIVE MODE;
SELECT set_config('kyf.legacy_owner', :'legacy_owner', true),
       set_config('kyf.account_id', :'account_id', true);

DO $$
DECLARE
    source_id bigint := current_setting('kyf.legacy_owner')::bigint;
    account_id bigint := current_setting('kyf.account_id')::bigint;
    target_id bigint := -account_id;
BEGIN
    IF account_id < 1 OR NOT EXISTS (SELECT 1 FROM kyf_accounts WHERE id = account_id) THEN
        RAISE EXCEPTION 'The destination account does not exist';
    END IF;
    IF source_id = target_id OR EXISTS (SELECT 1 FROM kyf_accounts WHERE -id = source_id) THEN
        RAISE EXCEPTION 'The source must be unassigned legacy data';
    END IF;
    IF EXISTS (SELECT 1 FROM transactions WHERE user_id = target_id)
       OR EXISTS (SELECT 1 FROM monthly_budgets WHERE user_id = target_id)
       OR EXISTS (SELECT 1 FROM user_profile WHERE user_id = target_id) THEN
        RAISE EXCEPTION 'The destination must be empty';
    END IF;
    IF NOT (EXISTS (SELECT 1 FROM transactions WHERE user_id = source_id)
       OR EXISTS (SELECT 1 FROM monthly_budgets WHERE user_id = source_id)
       OR EXISTS (SELECT 1 FROM user_profile WHERE user_id = source_id)) THEN
        RAISE EXCEPTION 'The source has no data';
    END IF;

    UPDATE transactions SET user_id = target_id WHERE user_id = source_id;
    UPDATE monthly_budgets SET user_id = target_id WHERE user_id = source_id;
    UPDATE user_profile SET user_id = target_id WHERE user_id = source_id;
END $$;

COMMIT;
