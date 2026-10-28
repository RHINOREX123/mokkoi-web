import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { XRAY_CONTACT_EMAIL } from '../constants/xray'
import { XrayNav, XrayFooter } from './xray/chrome'
import './xray-landing.css'

// NOTE: first-draft policies written for launch. Have them reviewed by a lawyer before
// taking significant revenue (governing law, liability caps and tax details are not covered yet).

type DocId = 'terms' | 'privacy' | 'refunds' | 'support'

const UPDATED = '29 October 2026'
const mail = <a href={`mailto:${XRAY_CONTACT_EMAIL}`}>{XRAY_CONTACT_EMAIL}</a>

const DOCS: Record<DocId, { title: string; meta?: string; body: ReactNode }> = {
  terms: {
    title: 'Terms of use',
    meta: `Last updated ${UPDATED}`,
    body: (
      <>
        <p>These terms cover your use of mokkoi.com and the reports Mokkoi produces. By ordering a report you agree to them.</p>
        <h2>What Mokkoi does</h2>
        <p>Mokkoi produces due diligence reports ("X-rays") on online businesses, usually ones listed for sale. A report combines automated checks of public information and, where a seller has given access, data the seller shares with us.</p>
        <h2>Reports are information, not advice</h2>
        <p>A report helps you ask better questions. It is not legal, financial, tax or investment advice, and it is not a guarantee about a business. Decisions to buy, sell or invest are yours. For larger deals we recommend professional advisors as well.</p>
        <h2>Accuracy</h2>
        <p>We link findings to the evidence behind them and mark anything we cannot confirm as a question. Public data can still be wrong or out of date, and businesses change. We provide reports "as is", without warranties beyond those required by law.</p>
        <h2>Your responsibilities</h2>
        <ul>
          <li>Use Mokkoi lawfully and for genuine evaluation of a business.</li>
          <li>Only share access (such as Stripe, analytics or code) that you own or are authorised to share.</li>
          <li>Don't use reports to harass sellers or publish their private information.</li>
        </ul>
        <h2>Public data and consent</h2>
        <p>Without the business owner's consent, Mokkoi only uses publicly available information. We do not log in to systems, bypass access controls or test a business's security without the owner's permission.</p>
        <h2>Using your report</h2>
        <p>You may use your report for your own decision and share it with your advisors, partners or the seller. Please don't resell or republish it. Seller "Verified" reports may be linked from the seller's own listing.</p>
        <h2>Payments and refunds</h2>
        <p>Prices are shown before you order. Refunds follow our <Link to="/refunds">refund policy</Link>.</p>
        <h2>Liability</h2>
        <p>To the extent the law allows, Mokkoi's total liability for any report is limited to the amount you paid for it, and we are not liable for indirect losses, including losses from buying or not buying a business.</p>
        <h2>Changes and contact</h2>
        <p>We may update these terms and will change the date above when we do. Questions: {mail}.</p>
      </>
    ),
  },
  privacy: {
    title: 'Privacy policy',
    meta: `Last updated ${UPDATED}`,
    body: (
      <>
        <p>This policy explains what Mokkoi collects, why, and what you can ask us to do with it.</p>
        <h2>What we collect</h2>
        <ul>
          <li>Your contact details, such as your email, so we can deliver reports and reply to you.</li>
          <li>The listings and websites you ask us to check, and the reports we produce.</li>
          <li>Access a seller chooses to share (for example a read-only Stripe or analytics connection), used only for that report.</li>
          <li>Basic website analytics, such as pages visited, to improve the site.</li>
        </ul>
        <p>Payments are handled by our payment provider. We never see or store your full card details.</p>
        <h2>How we use it</h2>
        <p>To produce and deliver reports, provide support, prevent abuse, and improve Mokkoi. We don't sell personal data.</p>
        <h2>Who processes it for us</h2>
        <p>We use trusted providers to run the service: hosting (Vercel), database and storage (Supabase), AI analysis (Anthropic), payments and email delivery. They process data only to provide their service to us.</p>
        <h2>Seller access and retention</h2>
        <p>Shared access is read-only and stored encrypted. We remove it once the report is delivered. Reports are kept so you can view them later; ask us and we'll delete yours.</p>
        <h2>Your choices</h2>
        <p>You can ask to see, correct or delete your data at any time by emailing {mail}.</p>
      </>
    ),
  },
  refunds: {
    title: 'Refund policy',
    meta: `Last updated ${UPDATED}`,
    body: (
      <>
        <h2>We couldn't deliver</h2>
        <p>If we can't produce the report you paid for, for example because the business can't be checked, you get a full refund.</p>
        <h2>Something in the report is wrong</h2>
        <p>If a finding is factually wrong because of our mistake, tell us within 14 days. We'll correct the report, or refund you if a corrected report isn't useful any more.</p>
        <h2>What isn't refundable</h2>
        <p>A delivered, accurate report isn't refundable because you disagree with its verdict, or because a deal went ahead or fell through.</p>
        <h2>How to ask</h2>
        <p>Email {mail} with the email you ordered with and the report link.</p>
      </>
    ),
  },
  support: {
    title: 'Support',
    body: (
      <>
        <p>Questions about an order, a report, or whether Mokkoi can check a particular business? Email us at {mail}. We reply as soon as we can, usually within a day.</p>
        <h2>To help us answer faster</h2>
        <ul>
          <li>The email you ordered with</li>
          <li>The listing or website link</li>
          <li>The report link, if you have one</li>
        </ul>
        <h2>Elsewhere</h2>
        <p>You can also reach us on <a href="https://x.com/Mokkoi_dev" rel="noopener noreferrer" target="_blank">X (Twitter)</a>. For refunds, see our <Link to="/refunds">refund policy</Link>.</p>
      </>
    ),
  },
}

export default function XrayDocPage({ page }: { page: DocId }) {
  const doc = DOCS[page]
  return (
    <div className="xr">
      <div className="xr-wrap">
        <XrayNav />
        <main className="xr-doc">
          <h1>{doc.title}</h1>
          {doc.meta && <p className="xr-doc-meta">{doc.meta}</p>}
          {doc.body}
        </main>
      </div>
      <XrayFooter />
    </div>
  )
}
