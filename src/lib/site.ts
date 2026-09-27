export const site = {
  name: "TBC Advisory",
  printName: "TBC Print",
  email: "info@tbcadvisory.com",
  url: "https://www.tbcadvisory.com",
  facebook: "https://www.facebook.com/profile.php?id=61571219743844",
  x: "https://www.x.com/TBCAdvsSrvs",
  locationCue: "Based in the Sarasota area, working with community boards across Florida.",
  locationShort: "Sarasota area · Florida",
  description:
    "TBC Advisory is not a property management company. We are an independent consultancy for HOA and COA board members.",
} as const;

export const nav = [
  { href: "/how-we-work", label: "How we work" },
  { href: "/for-boards", label: "For boards" },
  { href: "/about", label: "About" },
  { href: "/print", label: "Print" },
  { href: "/contact", label: "Contact" },
] as const;

export const engagementSteps = [
  {
    number: "01",
    title: "Discovery",
    summary:
      "We sit with directors and officers. We listen for what the board is trying to accomplish, where the management relationship is strained, and which issues keep returning to the agenda.",
  },
  {
    number: "02",
    title: "Assessment",
    summary:
      "We examine operations as they stand: vendors, communications, reserve practice, open projects, and how the management company is—or is not—being held to account.",
  },
  {
    number: "03",
    title: "Operational roadmap",
    summary:
      "The board receives a tailored plan: priorities, sequencing, and the decisions only directors can make. The aim is sustainability and fiscal responsibility, with less dependence on the firm already on contract.",
  },
  {
    number: "04",
    title: "Implementation support",
    summary:
      "We stay close while the board puts the roadmap to work. That can mean vendor oversight, project structure, communication cadence, or a clearer brief for management—counsel, not a second on-site staff.",
  },
] as const;

export const boardFocus = [
  {
    title: "Vendor oversight",
    body: "Scopes, bids, and performance. Someone has to hold the contractor to the agreement. Too often that someone is a director who already has a day job.",
  },
  {
    title: "Communications",
    body: "Owners deserve timely, plain-language updates. We help the board set a cadence and a standard so the story of the community is not left to rumor.",
  },
  {
    title: "Reserves",
    body: "Fiscal responsibility is not a slogan. We help boards look clearly at reserve practice, upcoming capital needs, and the tradeoffs they will have to explain.",
  },
  {
    title: "Project management",
    body: "Capital and special projects need a spine: scope, timeline, decision points, and a person accountable for each. We help the board install that discipline.",
  },
  {
    title: "Management accountability",
    body: "If you already have a property manager, we help you manage them. Clear expectations. Documented follow-through. Less theater, more service.",
  },
] as const;

export const printOfferings = [
  {
    title: "Community placards",
    body: "Rules, amenities, notices, and the signs owners actually need to see—produced to the standard of the property, not a stock template.",
  },
  {
    title: "Property identification signs",
    body: "Entrance and building identification that reads as the community. Clear type, durable materials, and a finish that belongs at the gate.",
  },
  {
    title: "Wayfinding",
    body: "Direct residents, guests, and vendors without a scavenger hunt. Amenity paths, parking, offices, and gathering spaces.",
  },
  {
    title: "Tradeshow & corporate 3D-printed pieces",
    body: "Dimensional pieces for booths, displays, and corporate settings. Printed to spec for events and professional presentations.",
  },
] as const;

export const printNeedOptions = [
  "Community placards",
  "Property identification signs",
  "Wayfinding",
  "Tradeshow or corporate 3D-printed pieces",
  "A mix of the above",
  "Something else",
] as const;
