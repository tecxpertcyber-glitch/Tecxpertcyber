// ============================================================
// TECXPERT CYBER SERVICES — PRICE LIST
// ============================================================
// Edit this file to update prices, add/remove services, or
// change categories. Prices are in Kenyan Shillings (Ksh).
// ============================================================

export interface ServiceItem {
  name: string;
  price: string; // e.g. "500", "-", "Contact us"
}

export interface ServiceCategory {
  id: string;
  title: string;
  iconName:
    | "Briefcase"
    | "ShieldCheck"
    | "Globe"
    | "GraduationCap"
    | "Printer"
    | "Laptop"
    | "CreditCard"
    | "MousePointer2";
  color: string;
  bg: string;
  services: ServiceItem[];
}

export const CATEGORIES: ServiceCategory[] = [
  {
    id: "business",
    title: "Business & Legal",
    iconName: "Briefcase",
    color: "text-blue-400",
    bg: "bg-blue-400/10",
    services: [
      { name: "Business Registration", price: "500" },
      { name: "VAT / Rental Renewals", price: "300" },
      { name: "Motor Vehicle Transfer", price: "400" },
      { name: "AGPO Registration", price: "500" },
      { name: "Tax Compliance Certificate", price: "500" },
      { name: "CR 12 Application", price: "300" },
      { name: "Marriage Certificate", price: "500" },
      { name: "KRA Returns", price: "200" },
    ],
  },
  {
    id: "government",
    title: "Government & Identity",
    iconName: "ShieldCheck",
    color: "text-emerald-400",
    bg: "bg-emerald-400/10",
    services: [
      { name: "KRA PIN Registration", price: "200" },
      { name: "SHA Application", price: "200" },
      { name: "NSSF Application", price: "200" },
      { name: "Good Conduct Certificate", price: "150" },
      { name: "ID Card Application", price: "150" },
      { name: "Huduma Booking", price: "50" },
      { name: "TSC Number", price: "300" },
      { name: "Food Handler Certificate", price: "300" },
    ],
  },
  {
    id: "travel",
    title: "Travel & Immigration",
    iconName: "Globe",
    color: "text-amber-400",
    bg: "bg-amber-400/10",
    services: [
      { name: "Visa Application", price: "600" },
      { name: "Passport Application", price: "600" },
      { name: "East Africa Passport", price: "600" },
      { name: "USA Green Card Application", price: "300" },
    ],
  },
  {
    id: "education",
    title: "Education & Career",
    iconName: "GraduationCap",
    color: "text-purple-400",
    bg: "bg-purple-400/10",
    services: [
      { name: "HELB Application", price: "350" },
      { name: "Student Project / Business Plan", price: "Contact us" },
    ],
  },
  {
    id: "printing",
    title: "Printing & Design",
    iconName: "Printer",
    color: "text-rose-400",
    bg: "bg-rose-400/10",
    services: [
      { name: "Digital Passport Photo (2)", price: "50" },
      { name: "Digital Passport Photo (4)", price: "100" },
      { name: "Photo Printing (4×6)", price: "50" },
      { name: "Lamination", price: "50" },
      { name: "Binding (50 pages)", price: "100" },
      { name: "Scanning (per page)", price: "20" },
      { name: "Printing (color, per page)", price: "20" },
      { name: "Photocopy (per page)", price: "5" },
      { name: "Typing (per page)", price: "50" },
    ],
  },
  {
    id: "digital",
    title: "Digital & Creative",
    iconName: "Laptop",
    color: "text-cyan-400",
    bg: "bg-cyan-400/10",
    services: [
      { name: "Web Design", price: "800" },
      { name: "Software Solution", price: "400" },
      { name: "Logo Design", price: "500" },
      { name: "Business Card Design", price: "200" },
      { name: "Letterhead Design", price: "150" },
      { name: "Banner Design", price: "Contact us" },
    ],
  },
  {
    id: "driving",
    title: "Driving & Transport",
    iconName: "CreditCard",
    color: "text-orange-400",
    bg: "bg-orange-400/10",
    services: [
      { name: "Driving License Renewal", price: "200" },
      { name: "Smart DL Application", price: "200" },
      { name: "Interim Licence Application", price: "150" },
      { name: "PSV Badge Application", price: "150" },
      { name: "Temporary Permit", price: "200" },
      { name: "Motor Vehicle Acceptance", price: "400" },
      { name: "Motor Vehicle Inspection", price: "200" },
      { name: "Driving Licence Application", price: "200" },
    ],
  },
  {
    id: "other",
    title: "Other Services",
    iconName: "MousePointer2",
    color: "text-slate-400",
    bg: "bg-slate-400/10",
    services: [
      { name: "eCitizen Services", price: "Contact us" },
      { name: "Browsing (per minute)", price: "1" },
    ],
  },
];

// Business info — easy to update
export const BUSINESS = {
  name: "Tecxpert Cyber Services",
  phone: "+254 702 988155",
  whatsappNumber: "254702988155", // no +, no spaces
  email: "tecxpertcyber@gmail.com",
  tagline: "Fast. Reliable. Affordable.",
  location: "Kenya",
};
