<template>
  <div class="dc-tos">
    <h1 class="dc-tos__title">Terms of Service</h1>
    <p class="dc-tos__effective">Effective date: March 23, 2026</p>

    <section class="dc-tos__section">
      <h2>1. Acceptance of Terms</h2>
      <p>
        By accessing or using WikiLoop DoubleCheck ("the Service"), you agree to
        be bound by these Terms of Service. If you do not agree to these terms,
        please do not use the Service.
      </p>
    </section>

    <section class="dc-tos__section">
      <h2>2. Description of Service</h2>
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
      <h2>3. User Accounts</h2>
      <p>
        You may use the Service without an account to browse edits and scores.
        To submit judgements, you must log in with your Wikipedia account via
        OAuth 2.0. We do not create separate accounts; your identity is your
        Wikipedia username as provided by the Wikimedia OAuth service. You are
        responsible for maintaining the security of your Wikipedia account.
      </p>
    </section>

    <section class="dc-tos__section">
      <h2>4. User Contributions</h2>
      <p>
        When you submit a judgement (Should Revert, Not Sure, or Looks Good),
        that judgement is recorded publicly along with your Wikipedia username
        and a timestamp. All judgements are public and visible to other users
        of the Service. By submitting a judgement, you acknowledge that your
        contribution will be publicly associated with your Wikipedia username.
      </p>
    </section>

    <section class="dc-tos__section">
      <h2>5. Acceptable Use</h2>
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
      <h2>6. Open Source License</h2>
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
        You are free to use, modify, and distribute the software in accordance
        with the terms of the Apache 2.0 license.
      </p>
    </section>

    <section class="dc-tos__section">
      <h2>7. Disclaimer of Warranties</h2>
      <p>
        The Service is provided "as is" and "as available" without warranties of
        any kind, either express or implied. The WikiLoop community does not
        warrant that the Service will be uninterrupted, error-free, or free of
        harmful components. AI-assisted scores are probabilistic and should not
        be treated as definitive assessments of edit quality.
      </p>
    </section>

    <section class="dc-tos__section">
      <h2>8. Limitation of Liability</h2>
      <p>
        To the fullest extent permitted by applicable law, the WikiLoop
        community and its contributors shall not be liable for any indirect,
        incidental, special, consequential, or punitive damages arising from
        your use of or inability to use the Service. The Service is a volunteer
        community project and is not operated for profit.
      </p>
    </section>

    <section class="dc-tos__section">
      <h2>9. Changes to Terms</h2>
      <p>
        We may update these Terms of Service from time to time. Changes will be
        posted on this page with an updated effective date. Continued use of the
        Service after changes are posted constitutes acceptance of the revised
        terms. Significant changes will be announced via the project's GitHub
        repository.
      </p>
    </section>

    <section class="dc-tos__section">
      <h2>10. Contact</h2>
      <p>
        If you have questions about these Terms of Service, please open an issue
        on our
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
  margin: 0 0 2rem;
}

.dc-tos__section {
  margin-bottom: 1.5rem;
}

.dc-tos__section h2 {
  font-size: 1.15rem;
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
