-- services.name is now typed by users in the rate-card builder, so it holds a
-- display string rather than a slug. Convert the seeded snake_case names.
update public.services set name = 'Missed Call Text Back'    where name = 'missed_call_text_back';
update public.services set name = 'Multichannel Capture'     where name = 'multichannel_capture';
update public.services set name = 'Qualification Logic'      where name = 'qualification_logic';
update public.services set name = 'Direct Calendar Booking'  where name = 'direct_calendar_booking';
update public.services set name = 'Reminder Sequence'        where name = 'reminder_sequence';
update public.services set name = 'Review Automation'        where name = 'review_automation';
update public.services set name = 'AI Voice Reception'       where name = 'ai_voice_reception';
update public.services set name = 'Reactivation Campaigns'   where name = 'reactivation_campaigns';
