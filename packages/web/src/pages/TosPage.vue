<template>
  <div class="dc-tos">
    <h1 class="dc-tos__title">Terms of Service &amp; Privacy Policy</h1>
    <p class="dc-tos__effective">Effective date: March 23, 2026</p>

    <nav class="dc-tos__nav">
      <strong>Contents:</strong>
      <a href="#terms">Terms of Service</a> &middot;
      <a href="#privacy">Privacy Policy</a>
    </nav>

    <hr class="dc-tos__divider" />

    <h2 id="terms" class="dc-tos__part-title">Part I — Terms of Service</h2>

    <section class="dc-tos__section">
      <h3>1. Acceptance of Terms</h3>
      <p>
        By accessing or using WikiLoop DoubleCheck ("the Service"), you agree to
        be bound by these Terms of Service and the Privacy Policy below. If you
        do not agree to these terms, please do not use the Service.
      </p>
    </section>

    <section class="dc-tos__section">
      <h3>2. Description of Service</h3>
      <p>
        WikiLoop DoubleCheck is an open-source community tool for reviewing
        Wikipedia edits for potential vandalism. The Service uses AI-assisted
        scoring from Wikimedia's Lift Wing machine learning API combined with
        human judgement to help maintain Wikipedia quality. The Service is
        available as a Web application, a Wikipedia UserScript, and a Chrome
        Extension.
      </p>
    </section>

    <section class="dc-tos__section">
      <h3>3. User Accounts</h3>
      <p>
        You may use the Service without an account to browse edits and scores.
        To submit judgements, you must log in with your Wikipedia account via
        OAuth 2.0. We do not create separate accounts; your identity is your
        Wikipedia username as provided by the Wikimedia OAuth service. You are
        responsible for maintaining the security of your Wikipedia account.
      </p>
    </section>

    <section class="dc-tos__section">
      <h3>4. User Contributions</h3>
      <p>
        When you submit a judgement (Should Revert, Not Sure, or Looks Good),
        that judgement is recorded publicly along with your Wikipedia username
        and a timestamp. All judgements are public and visible to other users
        of the Service. By submitting a judgement, you acknowledge that your
        contribution will be publicly associated with your Wikipedia username.
      </p>
    </section>

    <section class="dc-tos__section">
      <h3>5. Acceptable Use</h3>
      <p>You agree not to:</p>
      <ul>
        <li>Submit judgements in bad faith or to deliberately disrupt Wikipedia quality.</li>
        <li>Use automated scripts or bots to submit judgements without prior approval from the WikiLoop community.</li>
        <li>Attempt to manipulate or abuse the Service's voting system.</li>
        <li>Interfere with or disrupt the Service's infrastructure.</li>
        <li>Impersonate another user or misrepresent your identity.</li>
      </ul>
    </section>

    <section class="dc-tos__section">
      <h3>6. Open Source License</h3>
      <p>
        WikiLoop DoubleCheck is open-source software licensed under the
        <a
          href="https://www.apache.org/licenses/LICENSE-2.0"
          target="_blank"
          rel="noopener"
        >Apache License 2.0</a>.
        The source code is available at
        <a
          href="https://github.com/wikiloop/doublecheck"
          target="_blank"
          rel="noopener"
        >github.com/wikiloop/doublecheck</a>.
      </p>
    </section>

    <section class="dc-tos__section">
      <h3>7. Disclaimer of Warranties</h3>
      <p>
        The Service is provided "as is" and "as available" without warranties of
        any kind, either express or implied. The WikiLoop community does not
        warrant that the Service will be uninterrupted, error-free, or free of
        harmful components. AI-assisted scores are probabilistic and should not
        be treated as definitive assessments of edit quality.
      </p>
    </section>

    <section class="dc-tos__section">
      <h3>8. Limitation of Liability</h3>
      <p>
        To the fullest extent permitted by applicable law, the WikiLoop
        community and its contributors shall not be liable for any indirect,
        incidental, special, consequential, or punitive damages arising from
        your use of or inability to use the Service. The Service is a volunteer
        community project and is not operated for profit.
      </p>
    </section>

    <section class="dc-tos__section">
      <h3>9. Changes to Terms</h3>
      <p>
        We may update these Terms of Service from time to time. Changes will be
        posted on this page with an updated effective date. Continued use of the
        Service after changes are posted constitutes acceptance of the revised
        terms. Significant changes will be announced via the project's GitHub
        repository.
      </p>
    </section>

    <hr class="dc-tos__divider" />

    <h2 id="privacy" class="dc-tos__part-title">Part II — Privacy Policy</h2>

    <section class="dc-tos__section">
      <h3>10. What Data We Collect</h3>
      <p>WikiLoop DoubleCheck collects the minimum data necessary to operate:</p>
      <ul>
        <li>
          <strong>Wikipedia username</strong> — obtained via OAuth 2.0 when
          you log in with your Wikipedia account.
        </li>
        <li>
          <strong>Judgement votes</strong> — your review decisions (Should
          Revert, Not Sure, or Looks Good) on specific Wikipedia edits.
        </li>
        <li>
          <strong>Timestamps</strong> — when each judgement was submitted.
        </li>
      </ul>
    </section>

    <section class="dc-tos__section">
      <h3>11. What We Do NOT Collect</h3>
      <ul>
        <li>No email addresses.</li>
        <li>No personal information beyond your Wikipedia username.</li>
        <li>No tracking data, analytics cookies, or advertising identifiers.</li>
        <li>No IP addresses for profiling or tracking purposes.</li>
        <li>No browsing history or activity outside the Service.</li>
      </ul>
    </section>

    <section class="dc-tos__section">
      <h3>12. How Data Is Used</h3>
      <p>Your data is used solely to:</p>
      <ul>
        <li>Display judgements on edits to support community review of Wikipedia quality.</li>
        <li>Build leaderboards and review history for transparency.</li>
        <li>Enable consensus-based decisions on whether edits should be reverted.</li>
        <li>Improve the Service and support open research on Wikipedia edit quality.</li>
      </ul>
    </section>

    <section class="dc-tos__section">
      <h3>13. Data Storage</h3>
      <p>
        Judgement data is stored in MongoDB Atlas, a cloud-hosted database
        service. The Service is hosted on Wikimedia Toolforge and Vercel. All
        data is stored and transmitted using industry-standard security
        practices including encryption in transit (HTTPS/TLS).
      </p>
    </section>

    <section class="dc-tos__section">
      <h3>14. Third-Party Services</h3>
      <p>The Service interacts with the following third-party services:</p>
      <ul>
        <li>
          <strong>Wikimedia APIs</strong> — to fetch Wikipedia edit data,
          diffs, and user information.
        </li>
        <li>
          <strong>Wikimedia Lift Wing (ORES)</strong> — a machine learning
          API that provides vandalism probability scores for Wikipedia edits.
        </li>
        <li>
          <strong>Wikimedia OAuth 2.0</strong> — for user authentication
          via your Wikipedia account.
        </li>
      </ul>
      <p>
        These services are operated by the Wikimedia Foundation and are subject
        to the
        <a
          href="https://foundation.wikimedia.org/wiki/Privacy_policy"
          target="_blank"
          rel="noopener"
        >Wikimedia Foundation Privacy Policy</a>.
      </p>
    </section>

    <section class="dc-tos__section">
      <h3>15. Cookies</h3>
      <p>
        WikiLoop DoubleCheck uses only session cookies required for
        authentication. We do not use tracking cookies, analytics cookies, or
        any third-party cookies. Session cookies are automatically deleted when
        you close your browser or when your session expires.
      </p>
    </section>

    <section class="dc-tos__section">
      <h3>16. Data Retention</h3>
      <p>
        Judgement data is retained indefinitely to maintain a complete and
        transparent record of community review decisions. Because judgements
        contribute to the collective assessment of Wikipedia edit quality, they
        are considered community contributions rather than personal data.
      </p>
    </section>

    <section class="dc-tos__section">
      <h3>17. Your Rights</h3>
      <p>
        All judgements submitted through the Service are public. You can view
        your own judgement history when logged in. If you wish to request
        deletion of your judgement data, please open an issue on our
        <a
          href="https://github.com/wikiloop/doublecheck/issues"
          target="_blank"
          rel="noopener"
        >GitHub repository</a>.
        We will process deletion requests in accordance with applicable law.
      </p>
    </section>

    <section class="dc-tos__section">
      <h3>18. Open Source Transparency</h3>
      <p>
        WikiLoop DoubleCheck is fully open source. You can inspect exactly what
        data the Service collects and how it is processed by reviewing the
        source code at
        <a
          href="https://github.com/wikiloop/doublecheck"
          target="_blank"
          rel="noopener"
        >github.com/wikiloop/doublecheck</a>.
      </p>
    </section>

    <section class="dc-tos__section">
      <h3>19. Children's Privacy</h3>
      <p>
        The Service is not directed at children under the age of 13. We do not
        knowingly collect personal information from children under 13. If you
        believe a child under 13 has provided data through the Service, please
        contact us via GitHub so we can take appropriate action.
      </p>
    </section>

    <section class="dc-tos__section">
      <h3>20. Changes to This Policy</h3>
      <p>
        We may update this document from time to time. Changes will be
        posted on this page with an updated effective date. Significant changes
        will be announced via the project's GitHub repository.
      </p>
    </section>

    <section class="dc-tos__section">
      <h3>21. Contact</h3>
      <p>
        If you have questions about these Terms of Service or Privacy Policy,
        please open an issue on our
        <a
          href="https://github.com/wikiloop/doublecheck/issues"
          target="_blank"
          rel="noopener"
        >GitHub repository</a>.
      </p>
    </section>
  </div>
</template>

<style scoped>
.dc-tos {
  max-width: 760px;
  margin: 0 auto;
  padding: 2rem 1rem;
}

.dc-tos__title {
  font-size: 1.8rem;
  margin: 0 0 0.25rem;
}

.dc-tos__effective {
  color: var(--color-subtle);
  font-size: 0.9rem;
  margin: 0 0 1rem;
}

.dc-tos__nav {
  margin-bottom: 1.5rem;
  font-size: 0.95rem;
}

.dc-tos__nav a {
  color: var(--color-progressive);
  text-decoration: none;
}

.dc-tos__nav a:hover {
  text-decoration: underline;
}

.dc-tos__divider {
  border: none;
  border-top: 1px solid var(--border-color-base, #ccc);
  margin: 2rem 0;
}

.dc-tos__part-title {
  font-size: 1.4rem;
  margin: 0 0 1.5rem;
}

.dc-tos__section {
  margin-bottom: 1.5rem;
}

.dc-tos__section h3 {
  font-size: 1.1rem;
  margin: 0 0 0.5rem;
}

.dc-tos__section p {
  line-height: 1.7;
  margin: 0 0 0.5rem;
  color: var(--color-base);
}

.dc-tos__section ul {
  margin: 0.5rem 0;
  padding-left: 1.5rem;
  line-height: 1.7;
}

.dc-tos__section li {
  margin-bottom: 0.3rem;
}

.dc-tos__section a {
  color: var(--color-progressive);
  text-decoration: none;
}

.dc-tos__section a:hover {
  text-decoration: underline;
}
</style>
