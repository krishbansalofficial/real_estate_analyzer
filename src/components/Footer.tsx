import { Link } from "react-router-dom";
import { Database, Github, MapPin } from "lucide-react";

const linkClass =
  "text-sm text-primary-foreground/70 hover:text-primary-foreground transition-colors";

const Footer = () => {
  return (
    <footer className="bg-primary text-primary-foreground py-16 md:py-20">
      <div className="container-calm">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10 md:gap-8">
          {/* Brand */}
          <div className="md:col-span-2">
            <Link to="/" className="flex items-center gap-2 mb-4">
              <div className="w-10 h-10 rounded-xl bg-primary-foreground/10 flex items-center justify-center">
                <span className="text-primary-foreground font-serif text-lg font-semibold">
                  R
                </span>
              </div>
              <span className="font-serif text-xl font-medium">
                Real Estate Analyzer
              </span>
            </Link>
            <p className="text-primary-foreground/70 text-sm leading-relaxed max-w-sm">
              Machine-learning price estimates with honest ranges. An educational
              project, not an appraisal.
            </p>
            <p className="flex items-center gap-2 text-sm text-primary-foreground/70 mt-4">
              <MapPin className="w-4 h-4" />
              Blacksburg, VA
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="font-medium mb-4">Explore</h4>
            <ul className="space-y-3">
              <li>
                <Link to="/" className={linkClass}>
                  Home
                </Link>
              </li>
              <li>
                <Link to="/analyzer" className={linkClass}>
                  Price Analyzer
                </Link>
              </li>
              <li>
                <Link to="/about" className={linkClass}>
                  How it works
                </Link>
              </li>
            </ul>
          </div>

          {/* Resources */}
          <div>
            <h4 className="font-medium mb-4">Resources</h4>
            <ul className="space-y-3">
              <li>
                <a
                  href="https://www.kaggle.com/datasets/ahmedshahriarsakib/usa-real-estate-dataset"
                  target="_blank"
                  rel="noreferrer"
                  className={`${linkClass} inline-flex items-center gap-2`}
                >
                  <Database className="w-4 h-4" />
                  Dataset
                </a>
              </li>
              <li>
                <a
                  href="https://github.com/krishbansalofficial/real_estate_analyzer"
                  target="_blank"
                  rel="noreferrer"
                  className={`${linkClass} inline-flex items-center gap-2`}
                >
                  <Github className="w-4 h-4" />
                  Source code
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-primary-foreground/10">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-sm text-primary-foreground/50">
              © {new Date().getFullYear()} Real Estate Analyzer
            </p>
            <Link
              to="/privacy"
              className="text-sm text-primary-foreground/50 hover:text-primary-foreground transition-colors"
            >
              Privacy
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
