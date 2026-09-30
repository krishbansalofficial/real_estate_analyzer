import Footer from "@/components/Footer";
import Navbar from "@/components/Navbar";

const LAST_UPDATED = "September 28, 2026";

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="mb-10">
    <h2 className="heading-card text-foreground mb-3">{title}</h2>
    <div className="body-regular space-y-3">{children}</div>
  </section>
);

const Privacy = () => (
  <div className="min-h-screen bg-background">
    <Navbar />

    <main className="pt-28 pb-16">
      <div className="container-calm max-w-3xl">
        <h1 className="heading-hero text-foreground mb-4">Privacy</h1>
        <p className="text-sm text-muted-foreground mb-10">Last updated {LAST_UPDATED}</p>

        <Section title="The short version">
          <p>
            There are no accounts, cookies, ads or analytics. We don't ask for your name, email
            or address, and we don't sell or share anything you enter.
          </p>
        </Section>

        <Section title="What we collect">
          <p>
            When you request an estimate, the property details you enter (bedrooms, bathrooms,
            living area, lot size, zip code, city and state) are sent to our server to calculate
            the price.
          </p>
          <p>
            If prediction logging is enabled, we store those details together with the estimate,
            the model version and the time of the request, so we can measure how the model is
            used and improve it. We do not store your IP address or anything that identifies you
            with these records. Note that a full street address is never sent: the address search
            only fills in the zip code, city and state.
          </p>
        </Section>

        <Section title="Services we rely on">
          <p>
            <strong>Hosting.</strong> Like any website, our hosting provider automatically
            processes technical data such as your IP address and browser type to deliver the site
            and protect it from abuse, and may keep it in short-lived request logs. Our API also
            uses your IP address in memory to limit each visitor to 60 estimates per minute; it is
            not written to our database.
          </p>
          <p>
            <strong>Google Maps.</strong> If the address search is available on the Analyzer page,
            it is provided by Google Maps Platform. What you type into that search box goes
            directly to Google and is covered by{" "}
            <a
              className="text-primary underline underline-offset-4"
              href="https://policies.google.com/privacy"
              target="_blank"
              rel="noreferrer"
            >
              Google's Privacy Policy
            </a>
            . You can skip it and type the zip code, city and state into the fields instead.
          </p>
        </Section>

        <Section title="Browser storage">
          <p>
            The site doesn't set cookies or use local storage. Estimates for the example homes on
            the home page are kept in memory only until you close the tab.
          </p>
        </Section>

        <Section title="Retention and deletion">
          <p>
            Logged predictions aren't linked to you, so we can't find or delete "your" records
            individually. We may delete or aggregate the log at any time.
          </p>
        </Section>

        <Section title="Children">
          <p>This is a general-audience educational tool and isn't directed at children.</p>
        </Section>

        <Section title="Changes and contact">
          <p>
            If this policy changes, we'll update the date above. Questions? Open an issue on the{" "}
            <a
              className="text-primary underline underline-offset-4"
              href="https://github.com/krishbansalofficial/real_estate_analyzer/issues"
              target="_blank"
              rel="noreferrer"
            >
              project's GitHub page
            </a>
            .
          </p>
        </Section>
      </div>
    </main>

    <Footer />
  </div>
);

export default Privacy;
