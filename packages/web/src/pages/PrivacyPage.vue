<template>
  <div class="dc-privacy">
    <h1 class="dc-privacy__title">Privacy Policy</h1>
    <p class="dc-privacy__effective">Effective date: March 23, 2026</p>

    <section class="dc-privacy__section">
      <h2>1. What Data We Collect</h2>
      <p>
        WikiLoop DoubleCheck collects the minimum data necessary to operate:
      </p>
      <ul>
        <li>
          <strong>Wikipedia username</strong> &mdash; obtained via OAuth 2.0 when
          you log in with your Wikipedia account.
        </li>
        <li>
          <strong>Judgement votes</strong> &mdash; your review decisions (Should
          Revert, Not Sure, or Looks Good) on specific Wikipedia edits.
        </li>
        <li>
          <strong>Timestamps</strong> &mdash; when each judgement was submitted.
        </li>
      </ul>
    </section>

    <section class="dc-privacy__section">
      <h2>2. What We Do NOT Collect</h2>
      <p>We want to be clear about what we do not collect:</p>
      <ul>
        <li>No email addresses.</li>
        <li>No personal information beyond your Wikipedia username.</li>
        <li>No tracking data, analytics cookies, or advertising identifiers.</li>
        <li>No IP addresses for profiling or tracking purposes.</li>
        <li>No browsing history or activity outside the Service.</li>
      </ul>
    </section>

    <section class="dc-privacy__section">
      <h2>3. How Data Is Used</h2>
      <p>Your data is used solely to:</p>
      <ul>
        <li>Display judgements on edits to support community review of Wikipedia quality.</li>
        <li>Build leaderboards and review history for transparency.</li>
        <li>Enable consensus-based decisions on whether edits should be reverted.</li>
        <li>Improve the Service and support open research on Wikipedia edit quality.</li>
      </ul>
    </section>

    <section class="dc-privacy__section">
      <h2>4. Data Storage</h2>
      <p>
        Judgement data is stored in MongoDB Atlas, a cloud-hosted database
        service. The Service is hosted on Wikimedia Toolforge and Vercel. All
        data is stored and transmitted using industry-standard security
        practices including encryption in transit (HTTPS/TLS).
      </p>
    </section>

    <section class="dc-privacy__section">
      <h2>5. Third-Party Services</h2>
      <p>The Service interacts with the following third-party services:</p>
      <ul>
        <li>
          <strong>Wikimedia APIs</strong> &mdash; to fetch Wikipedia edit data,
          diffs, and user information.
        </li>
        <li>
          <strong>Wikimedia Lift Wing (ORES)</strong> &mdash; a machine learning
          API that provides vandalism probability scores for Wikipedia edits.
        </li>
        <li>
          <strong>Wikimedia OAuth 2.0</strong> &mdash; for user authentication
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

    <section class="dc-privacy__section">
      <h2>6. Cookies</h2>
      <p>
        WikiLoop DoubleCheck uses only session cookies required for
        authentication. We do not use tracking cookies, analytics cookies, or
        any third-party cookies. Session cookies are automatically deleted when
        you close your browser or when your session expires.
      </p>
    </section>

    <section class="dc-privacy__section">
      <h2>7. Data Retention</h2>
      <p>
        Judgement data is retained indefinitely to maintain a complete and
        transparent record of community review decisions. Because judgements
        contribute to the collective assessment of Wikipedia edit quality, they
        are considered community contributions rather than personal data.
      </p>
    </section>

    <section class="dc-privacy__section">
      <h2>8. Your Rights</h2>
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

    <section class="dc-privacy__section">
      <h2>9. Open Source Transparency</h2>
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

    <section class="dc-privacy__section">
      <h2>10. Children's Privacy</h2>
      <p>
        The Service is not directed at children under the age of 13. We do not
        knowingly collect personal information from children under 13. If you
        believe a child under 13 has provided data through the Service, please
        contact us via GitHub so we can take appropriate action.
      </p>
    </section>

    <section class="dc-privacy__section">
      <h2>11. Changes to This Policy</h2>
      <p>
        We may update this Privacy Policy from time to time. Changes will be
        posted on this page with an updated effective date. Significant changes
        will be announced via the project's GitHub repository.
      </p>
    </section>

    <section class="dc-privacy__section">
      <h2>12. Contact</h2>
      <p>
        If you have questions about this Privacy Policy, please open an issue on
        our
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
.dc-privacy {
  max-width: 760px;
  margin: 0 auto;
  padding: 2rem 1rem;
}

.dc-privacy__title {
  font-size: 1.8rem;
  margin: 0 0 0.25rem;
}

.dc-privacy__effective {
  color: var(--color-subtle);
  font-size: 0.9rem;
  margin: 0 0 2rem;
}

.dc-privacy__section {
  margin-bottom: 1.5rem;
}

.dc-privacy__section h2 {
  font-size: 1.15rem;
  margin: 0 0 0.5rem;
}

.dc-privacy__section p {
  line-height: 1.7;
  margin: 0 0 0.5rem;
  color: var(--color-base);
}

.dc-privacy__section ul {
  margin: 0.5rem 0;
  padding-left: 1.5rem;
  line-height: 1.7;
}

.dc-privacy__section li {
  margin-bottom: 0.3rem;
}

.dc-privacy__section a {
  color: var(--color-progressive);
  text-decoration: none;
}

.dc-privacy__section a:hover {
  text-decoration: underline;
}
</style>
