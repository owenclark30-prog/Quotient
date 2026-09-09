/** Starting points for the documents most agencies send every new client.
 *
 * Each one is shaped like the document it actually is — the intake form is a
 * form, the checklist is a checklist — because a template that all reads like
 * the same letter is no faster than starting from blank.
 *
 * All of it is the agency's own text to rewrite. Nothing here is generated
 * per client: the only thing that varies is the placeholders. */

export type DocumentStarter = {
  name: string;
  description: string;
  /** Shown after creating, when the document needs a warning the body alone
   * shouldn't have to carry. */
  caution?: string;
  body: string;
};

export const BLANK_STARTER = `Hi {{client_name}},

Welcome to {{tier_name}}. Here's what's included:

{{services}}

— {{agency_name}}`;

export const DOCUMENT_STARTERS: DocumentStarter[] = [
  {
    name: "Welcome pack",
    description: "What they bought, what happens next, what you need from them.",
    body: `Welcome aboard, {{client_name}}.

We're glad to have you. This covers what you've signed up for, what happens next, and how to reach us.

WHAT YOU'RE ON
{{tier_name}}

WHAT'S INCLUDED
{{services}}

WHAT HAPPENS NEXT
1. You'll get an intake form from us within 24 hours. The sooner it comes back, the sooner we start.
2. We'll book a kickoff call to walk through your goals and collect access.
3. Build starts straight after kickoff. We'll tell you as each piece goes live.

WHAT WE'LL NEED FROM YOU
- Access to your website, ad accounts and CRM
- One point of contact who can answer questions and approve work
- Anything you already have: brand assets, past campaign data, existing copy

HOW TO REACH US
Reply to this and it comes straight to us. If something is urgent, say so in the subject line.

Looking forward to getting started.

— {{agency_name}}`,
  },
  {
    name: "Intake form",
    description: "The questions you need answered before you can start.",
    body: `INTAKE FORM — {{client_name}}
For the {{tier_name}} package with {{agency_name}}

Fill this in and send it back. Anything you're unsure about, leave blank and we'll cover it on the kickoff call.


--- THE BUSINESS ---

1. What does the business do, in one sentence?


2. Who is your ideal client? Be specific — where they are, what they can spend, what they actually want.


3. What is a new client worth to you in their first year?


4. How many enquiries do you get in a typical month, and where do they come from?


--- CURRENT SETUP ---

5. What are you using now? (CRM, booking, email, phone)


6. Who handles enquiries today, and how quickly do they usually reply?


7. What happens to an enquiry that doesn't book? Be honest — "nothing" is a common answer.


--- GOALS ---

8. What does a good three months from now look like, in numbers?


9. What have you already tried that didn't work?


10. Is there anything that would make this a failure for you even if the numbers were good?


--- ACCESS ---

11. Main point of contact
Name:
Email:
Phone:
Can they approve work without checking with anyone else?  Yes / No

12. Which of these can you give us access to?
[ ] Website and hosting
[ ] Meta Business Manager
[ ] Google Ads and Analytics
[ ] CRM
[ ] Phone or SMS provider
[ ] Domain and DNS


--- ANYTHING ELSE ---

13. What haven't we asked that we should know?


Send this back to {{agency_name}} and we'll get moving.`,
  },
  {
    name: "Kickoff checklist",
    description: "Your internal run of everything that has to happen first.",
    body: `KICKOFF CHECKLIST — {{client_name}}
{{tier_name}}

Internal. Not sent to the client as-is.


--- BEFORE KICKOFF ---
[ ] Proposal signed and returned
[ ] Setup fee cleared
[ ] Welcome pack sent
[ ] Intake form sent
[ ] Intake form returned and actually read
[ ] Kickoff call booked and in both calendars


--- ACCESS TO COLLECT ---
[ ] Website and hosting
[ ] Meta Business Manager — partner access, never a personal login
[ ] Google Ads and Analytics
[ ] CRM admin
[ ] Phone / SMS provider
[ ] Domain and DNS (needed before we can send email on their behalf)


--- ON THE KICKOFF CALL ---
[ ] Walk through their intake answers
[ ] Agree the goal and how it gets measured
[ ] Confirm who approves work and how fast
[ ] Set the reporting cadence and format
[ ] Name anything that will block us, and who unblocks it


--- WHAT WE'RE DELIVERING ---
{{services}}


--- FIRST WEEK ---
[ ] Accounts and tracking live and verified
[ ] Client added to reporting
[ ] An owner assigned to each deliverable above
[ ] First check-in booked


--- SIGN-OFF ---
[ ] Client has confirmed they're happy with what's live
[ ] Handover notes written for whoever runs this day to day


Owner: ____________________     Kickoff date: ____________________`,
  },
  {
    name: "Contract / agreement",
    description: "Scope, fees, term and sign-off. Needs a solicitor's eye.",
    caution:
      "This is a starting point, not legal advice — have a solicitor review it before you send it, and fill in every ______ blank. The first block in the document is a reminder to delete before sending.",
    body: `[ DELETE THIS BLOCK BEFORE SENDING ]
This template is a starting point, not legal advice. Have a solicitor review it
before you use it, and fill in every blank marked ______ below.
[ END OF BLOCK TO DELETE ]


SERVICES AGREEMENT

Between:   {{agency_name}} ("we", "us")
And:       {{client_name}} ("you", "the client")
Date:      ____________________


1. WHAT WE'RE DOING

We'll provide the {{tier_name}} package, covering:

{{services}}

Anything not on that list is out of scope, and we'll quote it separately before starting.


2. FEES

Setup fee:       £____________  due ____________________
Monthly fee:     £____________  due on the ______ of each month
Payment terms:   ______ days from invoice


3. TERM AND NOTICE

Starts on ____________________ and runs month to month.
Either side may end it with ______ days' written notice.
Anything already invoiced stays payable.


4. WHAT WE NEED FROM YOU

- Access to the accounts and systems agreed at kickoff
- A named contact who can approve work within ______ working days
- Accurate information about your business and your offer

If we're held up waiting on any of the above, timelines move by the same amount.


5. OWNERSHIP

Work produced for you becomes yours once it's paid for in full.
The tools, processes and templates we used to build it stay ours.


6. CONFIDENTIALITY

Neither side shares the other's private business information with anyone else, during this agreement or after it ends.


7. WHAT WE DON'T PROMISE

We don't guarantee specific results, rankings or revenue. We do commit to delivering the work in section 1 to a professional standard.


8. LIABILITY

Neither side is liable to the other for more than the fees paid in the ______ months before a claim.


9. GOVERNING LAW

Governed by the law of ____________________.


SIGNED


{{agency_name}}                         {{client_name}}


____________________________            ____________________________
Name:                                   Name:
Role:                                   Role:
Date:                                   Date:`,
  },
];
