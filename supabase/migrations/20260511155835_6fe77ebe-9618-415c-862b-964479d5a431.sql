DROP POLICY IF EXISTS "realtime_messages_deny_anon" ON realtime.messages;

CREATE POLICY "realtime_messages_deny_anon"
ON realtime.messages
AS RESTRICTIVE
FOR ALL
TO anon
USING (false)
WITH CHECK (false);