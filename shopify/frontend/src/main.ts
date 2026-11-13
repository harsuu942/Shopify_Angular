import {CommonModule, CurrencyPipe, DatePipe} from '@angular/common';
import {HttpClient, HttpHeaders, provideHttpClient, withInterceptors, HttpInterceptorFn, HttpErrorResponse} from '@angular/common/http';
import {Component, HostListener, computed, inject, signal, effect} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {bootstrapApplication, Title, Meta, DomSanitizer, SafeHtml} from '@angular/platform-browser';
import {catchError, throwError, of} from 'rxjs';

export const rateLimitInterceptor: HttpInterceptorFn = (req, next) => {
  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 429) {
        const retryHeader = error.headers.get('Retry-After');
        const retryAfter = retryHeader ? parseInt(retryHeader, 10) : 60;
        const msg = error.error?.message || 'Request limit reached. Please wait before retrying.';
        window.dispatchEvent(new CustomEvent('thp-rate-limit', {
          detail: {
            retryAfter: isNaN(retryAfter) || retryAfter <= 0 ? 60 : retryAfter,
            message: msg
          }
        }));
      }
      return throwError(() => error);
    })
  );
};

export interface ProductVariant {
  id: number;
  ean: string;
  variantSku: string;
  configCode: string;
  colour: string;
  baseColour: string;
  colourCode: string;
  paintType: string;
  heightMm?: number;
  widthMm?: number;
  depthMm?: number;
  panel: string;
  price: number;
  stock: number;
  availability: string;
  productionTime: string;
  leadTime: string;
  watts?: number;
  btu?: number;
  warrantyYears?: number;
  image?: string;
  discountPercent?: number;
}

export interface Product {
  id: number;
  sku: string;
  name: string;
  brand: string;
  category: string;
  description: string;
  price: number;
  stock: number;
  colour: string;
  finish: string;
  type?: string;
  warrantyYears: number;
  watts: number;
  btu: number;
  image: string;
  variants: ProductVariant[];
  _previewImage?: string;
  discountPercent?: number;
}

export interface Line {
  product: Product;
  quantity: number;
  variant?: ProductVariant;
  chosenColour?: string;
  chosenHeight?: number;
  chosenWidth?: number;
}

export interface Order {
  id: string;
  orderNumber?: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  total: number;
  status: string;
  fulfilmentStatus?: string;
  carrier?: string;
  trackingNumber?: string;
  estimatedDelivery?: string;
  discountCode?: string;
  discountAmount?: number;
  paymentMethod?: string;
  paymentStatus?: string;
  stripePaymentIntentId?: string;
  createdAt: string;
}

export interface SavedAddress {
  id: string;
  label: string;
  name: string;
  phone: string;
  addressLine: string;
  city: string;
  postcode: string;
}

export interface AddressPrediction {
  placeId: string;
  mainText: string;
  secondaryText: string;
  fullText: string;
}

export interface AppliedCoupon {
  code: string;
  label: string;
  discountPercent?: number;
  discountAmount?: number;
  freeShipping?: boolean;
}

export interface ProductReview {
  id: string | number;
  productId?: number;
  productSku?: string;
  category?: string;
  author: string;
  authorEmail?: string;
  customerKey?: string;
  location: string;
  role: string;
  rating: number;
  date?: string;
  createdAt?: string;
  title: string;
  comment: string;
  status?: string;
  verifiedPurchase: boolean;
  helpfulCount: number;
  isHelpfulClicked?: boolean;
}

export interface BlogPost {
  id?: number;
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  coverImage: string;
  category: string;
  tags: string;
  author: string;
  publishedAt: string;
  status: string;
  readTimeMinutes: number;
}

export interface FilterChip {
  id: string;
  label: string;
  type: string;
  value?: any;
}

export interface AccordionState {
  categories: boolean;
  price: boolean;
  colours: boolean;
  btu: boolean;
  brands: boolean;
  stock: boolean;
}

export interface NavChildItem {
  label: string;
  category?: string;
  query?: string;
  colour?: string;
  badge?: string;
}

export interface NavColumn {
  title: string;
  items: NavChildItem[];
}

export interface NavSubcategory {
  label: string;
  query: string;
  imageUrl?: string;
  badge?: string;
}

export interface CustomDynamicFilter {
  name: string;
  optionsStr?: string;
  options?: string[];
}

export interface NavFilterOptions {
  showPriceFilter: boolean;
  showAvailabilityFilter: boolean;
  showBrandFilter: boolean;
  showColourFilter: boolean;
  showBtuFilter: boolean;
  showPanelTypeFilter: boolean;
  showHeightFilter: boolean;
  showFuelTypeFilter: boolean;
  subcategoryHeading?: string;
  subcategories?: NavSubcategory[];
  customFilters?: CustomDynamicFilter[];
}

export interface NavParentMenu {
  id: string;
  title: string;
  category: string;
  icon: string;
  badge?: string;
  imageUrl?: string;
  description?: string;
  filterOptions?: NavFilterOptions;
  columns: NavColumn[];
  featuredPromo?: {
    tag: string;
    title: string;
    subtitle: string;
    cta: string;
    category?: string;
    query?: string;
    imageUrl: string;
  };
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule, CurrencyPipe, DatePipe],
  templateUrl: './app.component.html'
})
export class App {
  private http = inject(HttpClient);
  private titleService = inject(Title);
  private metaService = inject(Meta);
  private sanitizer = inject(DomSanitizer);

  // Core Catalogue Signals
  products = signal<Product[]>([]);
  heroBanners = signal<any[]>([
    {
      title: 'EXCLUSIVE PRICE DROP',
      body: 'Huge savings across designer radiators, luxury towel warmers, and complete bathroom suites. Guaranteed high heat outputs and long-term warranties.',
      tag: 'EXCLUSIVE',
      buttonText: 'Shop Now',
      offerNotice: 'Offer ends 23:59pm Tuesday',
      linkUrl: '#new-arrivals'
    },
    {
      title: 'ARCHITECTURAL DESIGNER RADIATORS',
      body: 'Anthracite, matte black & polished chrome column radiators engineered for maximum thermal heat output in modern British homes.',
      tag: 'EXCLUSIVE',
      buttonText: 'Shop Radiators',
      offerNotice: 'Offer ends 23:59pm Tuesday',
      linkUrl: '#new-arrivals'
    },
    {
      title: 'LUXURY HEATED TOWEL RAILS',
      body: 'Pristine ladder warmers and designer vertical rails keeping your towels cozy and your bathroom warmly heated all year round.',
      tag: 'EXCLUSIVE',
      buttonText: 'Shop Towel Rails',
      offerNotice: 'Offer ends 23:59pm Tuesday',
      linkUrl: '#new-arrivals'
    }
  ]);
  campaignBanners = signal<any[]>([
    {
      id: 101,
      tag: 'DESIGN-LED HEATING',
      title: 'Designer Radiators',
      body: 'Architectural warmth in statement finishes with superior heat outputs.',
      buttonText: 'Shop Collection →',
      linkUrl: '/category/Radiators',
      imageUrl: 'https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?auto=format&fit=crop&w=1000&q=80'
    },
    {
      id: 102,
      tag: 'INVISIBLE COMFORT',
      title: 'Underfloor Heating',
      body: 'Efficient, responsive room climate kits for modern tile and wood floors.',
      buttonText: 'Explore Range →',
      linkUrl: '/category/Underfloor Heating',
      imageUrl: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1000&q=80'
    }
  ]);

  currentBannerIndex = signal<number>(0);

  onCampaignClick(camp: any) {
    if (!camp) return;
    const link = camp.linkUrl || '';
    if (link.startsWith('/category/')) {
      const cat = link.replace('/category/', '').trim();
      this.chooseParentCategory(cat);
      return;
    }
    if (camp.title && camp.title.toLowerCase().includes('radiator')) {
      this.chooseParentCategory('Radiators');
      return;
    }
    if (camp.title && camp.title.toLowerCase().includes('underfloor')) {
      this.chooseParentCategory('Underfloor Heating');
      return;
    }
    if (link.startsWith('#')) {
      const el = document.querySelector(link);
      if (el) el.scrollIntoView({ behavior: 'smooth' });
      return;
    }
    if (link) {
      window.location.href = link;
    }
  }

  nextBanner() {
    this.currentBannerIndex.update(i => (i + 1) % this.heroBanners().length);
  }

  prevBanner() {
    this.currentBannerIndex.update(i => (i - 1 + this.heroBanners().length) % this.heroBanners().length);
  }

  setBanner(idx: number) {
    this.currentBannerIndex.set(idx);
  }

  heroBannerBg = computed(() => {
    const list = this.heroBanners();
    if (!list.length) return '#E47716';
    const idx = Math.min(this.currentBannerIndex(), list.length - 1);
    const cur = list[idx >= 0 ? idx : 0];
    if (cur?.imageUrl) {
      const imgUrl = this.imageSrc(cur.imageUrl);
      return `linear-gradient(90deg, rgba(15,23,42,0.48) 0%, rgba(15,23,42,0.18) 45%, rgba(15,23,42,0.02) 100%), url('${imgUrl}')`;
    }
    return '#E47716';
  });

  heroPreviewProducts = computed(() => {
    const list = this.products();
    const withImages = list.filter(p => !!p.image);
    return withImages.length >= 3 ? withImages.slice(0, 3) : list.slice(0, 3);
  });

  categoryDescExpanded = signal<boolean>(false);
  toggleCategoryDesc() {
    this.categoryDescExpanded.update(v => !v);
  }

  currentCategoryDescription = computed(() => {
    const cat = this.category;
    if (!cat) return 'Discover our extensive range of high-efficiency central heating radiators, designer horizontal and vertical radiators, and modern compact convectors engineered to keep your home warm and stylish throughout British winters.';
    const found = this.navigationMenu.find(m => this.categoryMatches(m.category, cat));
    return found?.description || `Explore our high quality collection of ${cat} engineered for exceptional thermal efficiency and modern British aesthetics.`;
  });

  selectedPriceRange = signal<string>('all');
  setPriceRange(range: string) {
    this.selectedPriceRange.set(range);
    if (range === 'all') {
      this.minPrice.set(0);
      this.maxPrice.set(9999);
    } else if (range === 'under150') {
      this.minPrice.set(0);
      this.maxPrice.set(150);
    } else if (range === '150-250') {
      this.minPrice.set(150);
      this.maxPrice.set(250);
    } else if (range === '250-400') {
      this.minPrice.set(250);
      this.maxPrice.set(400);
    } else if (range === '400-600') {
      this.minPrice.set(400);
      this.maxPrice.set(600);
    } else if (range === 'over600') {
      this.minPrice.set(600);
      this.maxPrice.set(9999);
    }
  }

  priceRangeCounts = computed(() => {
    const prods = this.products().filter(p => this.productMatchesActiveFilters(p, true));
    return {
      all: prods.length,
      under150: prods.filter(p => this.displayPrice(p) < 150).length,
      '150-250': prods.filter(p => this.displayPrice(p) >= 150 && this.displayPrice(p) <= 250).length,
      '250-400': prods.filter(p => this.displayPrice(p) > 250 && this.displayPrice(p) <= 400).length,
      '400-600': prods.filter(p => this.displayPrice(p) > 400 && this.displayPrice(p) <= 600).length,
      over600: prods.filter(p => this.displayPrice(p) > 600).length,
    };
  });

  setSort(mode: string) {
    this.sort.set(mode);
  }

  onBannerCtaClick(banner: any) {
    if (banner?.linkUrl) {
      const url = banner.linkUrl.trim();
      if (url.startsWith('#')) {
        const el = document.querySelector(url);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
          return;
        }
      }
    }
    this.scrollProducts();
  }

  reviewSlideIndex = signal<number>(0);

  nextReviewSlide() {
    const max = this.maxReviewSlideIndex();
    if (this.reviewSlideIndex() < max) {
      this.reviewSlideIndex.update(i => i + 1);
    }
  }

  prevReviewSlide() {
    if (this.reviewSlideIndex() > 0) {
      this.reviewSlideIndex.update(i => i - 1);
    }
  }

  maxReviewSlideIndex() {
    return Math.max(0, this.homeCustomerReviews().length - 3);
  }

  recentProducts = computed(() => {
    const list = this.products();
    const withImg = list.filter(p => !!p.image);
    return withImg.length ? withImg.slice(0, 8) : list.slice(0, 8);
  });

  isBrowsingCategory = computed(() => {
    return !!(this.category || this.selectedSubcategory() || this.inStockOnly() || this.selectedCategories().length > 0 || Object.keys(this.selectedCustomFilters()).length > 0);
  });

  currentSubcategoryLabel = computed(() => {
    const sub = this.selectedSubcategory();
    if (!sub) return '';
    const activeSub = this.activeMenuFilterOptions()?.subcategories?.find(s => s.query?.toLowerCase() === sub.toLowerCase());
    if (activeSub && activeSub.label) {
      return activeSub.label;
    }
    if (sub === 'DF') return 'Type 22 Double Convector (DF)';
    if (sub === 'SF') return 'Type 11 Single Convector (SF)';
    if (sub === 'HF') return 'Type 21 Double-Single (HF)';
    if (sub === 'DS') return 'Compact 6 DS (Double Multi-Port)';
    if (sub === 'TS') return 'Compact 6 TS (Triple High Output)';
    if (sub === 'QS') return 'Compact 6 QS (Quad Maximum Density)';
    if (sub === 'Alex') return 'Alex Heated Towel Rails';
    if (sub === 'Alex One') return 'Alex One Electric Towel Rails';
    if (sub === 'Dexter') return 'Dexter Contemporary Rails';
    if (sub === 'Dexter E') return 'Dexter E Electric Rails';
    if (sub === 'Easy') return 'Easy Slimline Towel Rails';
    if (sub === 'Easy One') return 'Easy One Electric Rails';
    if (sub === 'Fiona') return 'Fiona Classic Towel Rails';
    if (sub === 'Retro') return 'Retro Traditional Warmers';
    if (sub === 'Salisbury') return 'Salisbury Period Towel Rails';
    if (sub === 'Colorado') return 'Colorado Column Radiators';
    if (sub === 'Bergamo') return 'Bergamo Sectional Radiators';
    if (sub === 'Forte') return 'Forte Panel Radiators';
    if (sub === 'Cylindrical') return 'Cylindrical TRV Valves';
    if (sub === 'Traditional') return 'Traditional Radiator Valves';
    if (sub === 'Twins') return 'Vario Twins 50mm Integrated Sets';
    if (sub === 'Vision') return 'Vario Vision 3-Axis TRVs';
    if (sub === 'KTX') return 'KTX-4 Smart WiFi Elements';
    if (sub === 'MOA') return 'MOA Digital Heating Elements';
    if (sub === 'Probe') return 'Terma SS1 Smart Split Probes';
    if (sub === 'Dual Fuel' || sub === 'T-Piece') return 'Dual Fuel T-Piece Adapters & Kits';
    if (sub === 'Pipe Masking' || sub === 'Sleeve') return 'Solid Brass Pipe Sleeves & Collars';
    return sub;
  });

  scrollSubcats(el: HTMLElement, amount: number) {
    if (el) {
      el.scrollBy({ left: amount, behavior: 'smooth' });
    }
  }

  currentCategoryTitle = computed(() => {
    const subLabel = this.currentSubcategoryLabel();
    if (subLabel) {
      return subLabel;
    }
    if (this.category) {
      if (this.category === 'Bathrooms') return 'Bathroom Suites & Furniture';
      return this.category;
    }
    if (this.inStockOnly()) return 'In Stock (Ready to Dispatch)';
    return 'All Living, Heating & Bathroom Collections';
  });
  allCatalogProducts = signal<Product[]>([]);
  categories = signal<string[]>([]);
  cart = signal<Line[]>(this.read<Line[]>('cart', []));
  wishlist = signal<Product[]>(this.read<Product[]>('wishlist', []));
  selected = signal<Product | null>(null);
  activeImage = signal('');
  zoomImage = signal('');
  isHoverZoom = signal(false);
  hoverZoomX = signal(50);
  hoverZoomY = signal(50);

  lightboxZoom = signal(1);
  lightboxPanX = signal(0);
  lightboxPanY = signal(0);
  isPanning = signal(false);
  panStartX = 0;
  panStartY = 0;

  lightboxAutoPlay = signal(true);
  lightboxProgress = signal(0);
  lightboxHovered = signal(false);
  private lightboxProgressTimer: any = null;


  get zoomPercent(): number {
    return Math.round(this.lightboxZoom() * 100);
  }

  get currentPhotoIndex(): number {
    const sel = this.selected();
    if (!sel) return 1;
    const list = this.galleryImages(sel);
    const idx = list.indexOf(this.zoomImage() || this.activeImage());
    return idx >= 0 ? idx + 1 : 1;
  }

  get totalPhotos(): number {
    const sel = this.selected();
    return sel ? this.galleryImages(sel).length : 1;
  }
  chosenColour = signal('');
  chosenHeight = signal<number | undefined>(undefined);
  chosenWidth = signal<number | undefined>(undefined);
  chosenPanel = signal('');
  activePdpTab = signal<'overview' | 'specs' | 'diagram' | 'delivery' | 'valves' | 'reviews'>('overview');
  deliveryCountdown = signal('3 hrs 24 mins');
  deliveryDay = signal('Wednesday');

  // Dynamic Product Reviews State (Loaded dynamically from API)
  reviews = signal<ProductReview[]>([]);

  // Review Modal & Filter Signals
  customerKey: string = this.getOrCreateCustomerKey();
  isReviewModalOpen = signal(false);
  reviewFilterRating = signal<number | null>(null);
  newReviewRating = signal(5);
  newReviewAuthor = signal('');
  newReviewAuthorEmail = signal('');
  newReviewLocation = signal('');
  newReviewRole = signal('Verified Homeowner');
  newReviewTitle = signal('');
  newReviewComment = signal('');
  isAdmin = signal(false);

  private getOrCreateCustomerKey(): string {
    let key = '';
    try {
      key = localStorage.getItem('thp_customer_key') || '';
      if (!key) {
        key = 'cust-' + Math.random().toString(36).substring(2, 11) + '-' + Date.now();
        localStorage.setItem('thp_customer_key', key);
      }
    } catch {
      key = 'cust-' + Date.now();
    }
    return key;
  }

  // Routing View & General State
  view = signal<'shop' | 'product' | 'cart' | 'wishlist' | 'login' | 'checkout' | 'confirmation' | 'account' | 'blog'>('shop');

  // Heat & Plumb Advice / Blog State
  blogs = signal<BlogPost[]>([]);
  selectedBlog = signal<BlogPost | null>(null);
  blogCategoryFilter = signal<string>('All');
  blogSearchQuery = signal<string>('');
  loadingBlogs = signal<boolean>(false);

  blogCategoriesList = [
    'Bathroom Ideas',
    'Inspiration',
    'Bathroom Fun',
    'Technical Guides',
    'Buyer Guides',
    'Heating Advice',
    'Plumbing Advice'
  ];

  blogCategories = computed(() => {
    return ['All', ...this.blogCategoriesList];
  });

  filteredBlogs = computed(() => {
    const all = this.blogs();
    const cat = this.blogCategoryFilter();
    const query = this.blogSearchQuery().trim().toLowerCase();
    return all.filter(b => {
      const matchCat = cat === 'All' || (b.category && b.category.toLowerCase() === cat.toLowerCase());
      const matchQuery = !query || 
        (b.title && b.title.toLowerCase().includes(query)) || 
        (b.excerpt && b.excerpt.toLowerCase().includes(query)) ||
        (b.tags && b.tags.toLowerCase().includes(query));
      return matchCat && matchQuery;
    });
  });

  featuredBlog = computed(() => {
    const filtered = this.filteredBlogs();
    return filtered.length > 0 ? filtered[0] : null;
  });

  gridBlogs = computed(() => {
    const filtered = this.filteredBlogs();
    if (this.blogSearchQuery().trim()) {
      return filtered;
    }
    return filtered.length > 1 ? filtered.slice(1) : [];
  });

  loading = signal(true);
  productQty = signal(1);
  productLimit = signal(24);
  authMode = signal<'login' | 'signup' | 'forgot' | 'reset'>('login');
  resetCode = signal('');
  newPassword = signal('');
  confirmNewPassword = signal('');
  resetDevCode = signal('');
  accountName = signal('Customer');
  success = signal('');
  orderSubmitting = signal(false);
  completedOrder = signal<Order | null>(null);
  orders = signal<Order[]>([]);
  error = signal('');
  toastMessage = signal('');
  toastAction = signal<string | null>(null);

  // Rate Limiting & Cooldown Protection State
  rateLimitActive = signal(false);
  rateLimitSeconds = signal(0);
  rateLimitMessage = signal('');
  private rateLimitTimer: any = null;

  // Form Submission Locks & Throttling
  authSubmitting = signal(false);
  isReviewSubmitting = signal(false);

  // Multi-Level Navigation Menu State
  activeNavHover = signal<string | null>(null);
  mobileNavOpen = signal(false);
  expandedMobileMenu = signal<string | null>(null);

  // Faceted Filter Signals
  private _querySignal = signal<string>('');
  get query(): string { return this._querySignal(); }
  set query(v: string) { this._querySignal.set(v || ''); }

  private _categorySignal = signal<string>('');
  get category(): string { return this._categorySignal(); }
  set category(v: string) { this._categorySignal.set(v || ''); }
  selectedCategories = signal<string[]>([]);
  selectedSubcategory = signal<string>('');
  selectedCustomFilters = signal<Record<string, string>>({});
  minPrice = signal<number>(0);
  maxPrice = signal<number>(2000);
  selectedColours = signal<string[]>([]);
  selectedBrands = signal<string[]>([]);
  btuRange = signal<'all' | 'under2k' | '2k-4k' | '4k-6k' | 'over6k'>('all');
  inStockOnly = signal<boolean>(false);
  sort = signal<string>('featured');
  viewMode = signal<'grid' | 'list'>('grid');
  showMobileFilters = signal<boolean>(false);

  // Filter Accordion Collapse State
  accordionState = signal<AccordionState>({
    categories: true,
    price: true,
    colours: true,
    btu: true,
    brands: true,
    stock: true
  });

  // BTU Calculator State
  btuRoomType = 'living';
  btuArea = 15;
  btuInsulation = 'standard';
  btuTemp = '21';
  estimatedBtu = signal(5120);
  estimatedWatts = signal(1500);

  // Auth / Checkout
  fullName = '';
  email = '';
  password = '';
  confirmPassword = '';
  checkoutName = '';
  checkoutPhone = '';
  checkoutPending = false;
  addressLine = '';
  city = '';
  postcode = '';
  restrictedPostcodeInfo = signal<{ restricted: boolean; region?: string; code?: string } | null>(null);

  // Google Places Autocomplete & UK Address Lookup
  googlePlacesApiKey = 'AIzaSyC_L2WUGbiUIJbGX0hRM7r_urd0ugf-K_I';
  addressPredictions = signal<AddressPrediction[]>([]);
  showAddressDropdown = signal<boolean>(false);
  searchingAddress = signal<boolean>(false);
  selectedPredictionIndex = signal<number>(-1);
  private addressSearchTimer: any = null;

  postcodePredictions = signal<AddressPrediction[]>([]);
  showPostcodeDropdown = signal<boolean>(false);
  searchingPostcode = signal<boolean>(false);
  selectedPostcodeIndex = signal<number>(-1);
  private postcodeSearchTimer: any = null;
  lookingUpPostcode = signal<boolean>(false);
  cardName = '';
  cardNumber = '';
  cardExpiry = '';
  cardCvc = '';
  termsAccepted = false;

  // Promotional Coupon / Discount Codes
  couponCode = '';
  appliedCoupon = signal<AppliedCoupon | null>(null);
  couponError = signal('');

  // Checkout Validation Signals
  nameError = signal<string>('');
  emailError = signal<string>('');
  phoneError = signal<string>('');
  addressError = signal<string>('');
  cityError = signal<string>('');
  postcodeError = signal<string>('');
  cardNameError = signal<string>('');
  cardNumberError = signal<string>('');
  cardExpiryError = signal<string>('');
  cardCvcError = signal<string>('');
  termsError = signal<string>('');

  // Payment Method Selection - Direct Card Processing via Stripe
  paymentMethod = signal<'card'>('card');
  stripePublishableKey = signal<string>('pk_test_51MockStripePublishableKeyForDevHearthRadiators009');
  stripeMode = signal<string>('sandbox_test');
  stripePaymentIntentId = signal<string>('');
  isTestCardPopulated = signal<boolean>(false);

  // 3D Secure (SCA) Challenge Modal Signals
  scaModalOpen = signal<boolean>(false);
  scaPendingIntentId = signal<string>('');
  scaClientSecret = signal<string>('');
  scaLoading = signal<boolean>(false);
  scaOtp = '123456';
  scaError = signal<string>('');

  clearAllCheckoutErrors() {
    this.nameError.set('');
    this.emailError.set('');
    this.phoneError.set('');
    this.addressError.set('');
    this.cityError.set('');
    this.postcodeError.set('');
    this.cardNameError.set('');
    this.cardNumberError.set('');
    this.cardExpiryError.set('');
    this.cardCvcError.set('');
    this.termsError.set('');
    this.error.set('');
    this.restrictedPostcodeInfo.set(null);
  }

  fillTestCard(type: 'success' | 'funds' | 'expired' | 'cvc' | 'declined' | 'sca' = 'success') {
    if (!this.checkoutName.trim()) this.checkoutName = 'Jane Customer';
    if (!this.email.trim()) this.email = 'customer@example.com';
    if (!this.checkoutPhone.trim()) this.checkoutPhone = '07123 456789';
    if (!this.addressLine.trim()) this.addressLine = '10 Downing Street';
    if (!this.city.trim()) this.city = 'London';
    if (!this.postcode.trim()) this.postcode = 'SW1A 2AA';
    this.cardName = this.checkoutName;
    this.termsAccepted = true;
    this.clearAllCheckoutErrors();
    this.isTestCardPopulated.set(true);

    if (type === 'success') {
      this.cardNumber = '4242 4242 4242 4242';
      this.cardExpiry = '12/28';
      this.cardCvc = '424';
      this.showToast('Test card: Successful Visa (4242)');
    } else if (type === 'funds') {
      this.cardNumber = '4000 0000 0000 0002';
      this.cardExpiry = '12/28';
      this.cardCvc = '424';
      this.showToast('Test card: Insufficient Funds (0002)');
    } else if (type === 'expired') {
      this.cardNumber = '4000 0000 0000 0069';
      this.cardExpiry = '12/28';
      this.cardCvc = '424';
      this.showToast('Test card: Expired Card Simulation (0069)');
    } else if (type === 'cvc') {
      this.cardNumber = '4000 0000 0000 0127';
      this.cardExpiry = '12/28';
      this.cardCvc = '424';
      this.showToast('Test card: Incorrect CVC (0127)');
    } else if (type === 'declined') {
      this.cardNumber = '4000 0000 0000 0005';
      this.cardExpiry = '12/28';
      this.cardCvc = '424';
      this.showToast('Test card: Card Declined (0005)');
    } else if (type === 'sca') {
      this.cardNumber = '4000 0000 0000 3155';
      this.cardExpiry = '12/28';
      this.cardCvc = '424';
      this.showToast('Test card: 3D Secure SCA (3155)');
    }
  }

  populateTestCard() {
    this.fillTestCard('success');
  }

  approveScaAuthentication() {
    if (this.scaLoading()) return;
    this.scaLoading.set(true);
    this.scaError.set('');

    const body = {
      paymentIntentId: this.scaPendingIntentId(),
      action: 'authorize_3ds'
    };

    this.http.post<any>('/api/checkout/stripe/confirm-payment', body).subscribe({
      next: () => {
        this.scaLoading.set(false);
        this.scaModalOpen.set(false);
        this.orderSubmitting.set(true);
        this.executeOrderSubmission(this.scaPendingIntentId());
      },
      error: (err) => {
        this.scaLoading.set(false);
        this.scaError.set(err.error?.message || err.error?.error || '3D Secure authentication failed.');
      }
    });
  }

  cancelScaAuthentication() {
    const intentId = this.scaPendingIntentId();
    this.scaModalOpen.set(false);
    this.orderSubmitting.set(false);
    this.scaLoading.set(false);
    this.error.set('3D Secure authentication was cancelled. Order not placed.');

    if (intentId) {
      this.http.post('/api/checkout/stripe/confirm-payment', { paymentIntentId: intentId, action: 'cancel_3ds' }).subscribe({
        next: () => {},
        error: () => {}
      });
    }
  }

  onCardNumberInput(event: Event) {
    const input = event.target as HTMLInputElement;
    let v = input.value.replace(/\D/g, '');
    if (v.length > 16) v = v.substring(0, 16);
    const parts = v.match(/[\s\S]{1,4}/g) || [];
    this.cardNumber = parts.join(' ');
    this.cardNumberError.set('');
  }

  onCardExpiryInput(event: Event) {
    const input = event.target as HTMLInputElement;
    let v = input.value.replace(/\D/g, '');
    if (v.length > 4) v = v.substring(0, 4);
    if (v.length >= 3) {
      this.cardExpiry = v.substring(0, 2) + '/' + v.substring(2);
    } else {
      this.cardExpiry = v;
    }
    this.cardExpiryError.set('');
  }

  onCardCvcInput(event: Event) {
    const input = event.target as HTMLInputElement;
    const v = input.value.replace(/\D/g, '').substring(0, 4);
    this.cardCvc = v;
    this.cardCvcError.set('');
  }

  onStreetAddressInput(event: Event) {
    const input = event.target as HTMLInputElement;
    this.addressLine = input.value;
    this.addressError.set('');

    const query = (input.value || '').trim();
    if (query.length < 3) {
      this.addressPredictions.set([]);
      this.showAddressDropdown.set(false);
      if (this.addressSearchTimer) clearTimeout(this.addressSearchTimer);
      return;
    }

    if (this.addressSearchTimer) clearTimeout(this.addressSearchTimer);
    this.addressSearchTimer = setTimeout(() => {
      this.fetchAddressPredictions(query);
    }, 280);
  }

  onStreetAddressFocus() {
    if (this.addressPredictions().length > 0) {
      this.showAddressDropdown.set(true);
    }
  }

  onStreetAddressBlur() {
    setTimeout(() => {
      this.showAddressDropdown.set(false);
    }, 250);
  }

  onAddressKeyDown(event: KeyboardEvent) {
    const preds = this.addressPredictions();
    if (!this.showAddressDropdown() || preds.length === 0) return;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.selectedPredictionIndex.update(i => (i + 1 < preds.length ? i + 1 : 0));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.selectedPredictionIndex.update(i => (i - 1 >= 0 ? i - 1 : preds.length - 1));
    } else if (event.key === 'Enter') {
      const idx = this.selectedPredictionIndex();
      if (idx >= 0 && idx < preds.length) {
        event.preventDefault();
        this.selectAddressPrediction(preds[idx]);
      }
    } else if (event.key === 'Escape') {
      this.showAddressDropdown.set(false);
    }
  }

  fetchAddressPredictions(query: string) {
    this.searchingAddress.set(true);
    const headers = new HttpHeaders({
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': this.googlePlacesApiKey
    });

    const body = {
      input: query,
      includedRegionCodes: ['gb']
    };

    this.http.post<any>('https://places.googleapis.com/v1/places:autocomplete', body, { headers }).subscribe({
      next: (res) => {
        this.searchingAddress.set(false);
        const suggestions = res?.suggestions || [];
        const mapped: AddressPrediction[] = suggestions.map((s: any) => {
          const p = s.placePrediction;
          return {
            placeId: p.placeId || (p.place ? p.place.replace('places/', '') : ''),
            mainText: p.structuredFormat?.mainText?.text || p.text?.text || '',
            secondaryText: p.structuredFormat?.secondaryText?.text || '',
            fullText: p.text?.text || ''
          };
        }).filter((p: AddressPrediction) => !!p.placeId && !!p.mainText);

        this.addressPredictions.set(mapped);
        this.showAddressDropdown.set(mapped.length > 0);
        this.selectedPredictionIndex.set(-1);
      },
      error: () => {
        this.searchingAddress.set(false);
      }
    });
  }

  selectAddressPrediction(pred: AddressPrediction, source: 'street' | 'postcode' = 'street') {
    this.showAddressDropdown.set(false);
    this.showPostcodeDropdown.set(false);
    if (source === 'postcode') {
      this.searchingPostcode.set(true);
    } else {
      this.searchingAddress.set(true);
    }

    const url = `https://places.googleapis.com/v1/places/${encodeURIComponent(pred.placeId)}?fields=id,formattedAddress,addressComponents&key=${this.googlePlacesApiKey}`;

    this.http.get<any>(url).subscribe({
      next: (data) => {
        this.searchingAddress.set(false);
        this.searchingPostcode.set(false);
        let streetNum = '';
        let route = '';
        let town = '';
        let postalCode = '';

        for (const comp of (data?.addressComponents || [])) {
          const types: string[] = comp.types || [];
          if (types.includes('street_number')) streetNum = comp.longText || comp.shortText || '';
          if (types.includes('route')) route = comp.longText || comp.shortText || '';
          if (types.includes('postal_town') || types.includes('locality')) {
            if (!town) town = comp.longText || comp.shortText || '';
          }
          if (types.includes('postal_code')) postalCode = comp.longText || comp.shortText || '';
        }

        // 1. Postcode
        if (postalCode) {
          this.postcode = postalCode.toUpperCase();
        } else if (source === 'postcode' && pred.mainText) {
          this.postcode = pred.mainText.toUpperCase();
        }
        if (this.postcode) {
          const check = this.checkUkRestrictedPostcode(this.postcode);
          if (check.restricted) {
            this.restrictedPostcodeInfo.set(check);
            this.postcodeError.set(`Restricted UK Delivery Area (${check.region}). Standard online courier delivery is unavailable.`);
          } else {
            this.restrictedPostcodeInfo.set(null);
            this.postcodeError.set('');
          }
        }

        // 2. Street Address
        if (streetNum && route) {
          this.addressLine = `${streetNum} ${route}`;
          this.addressError.set('');
        } else if (route) {
          this.addressLine = route;
          this.addressError.set('');
        } else if (source === 'street') {
          this.addressLine = pred.mainText || this.addressLine;
          this.addressError.set('');
        } else if (source === 'postcode' && pred.secondaryText) {
          const parts = pred.secondaryText.split(',');
          if (parts.length > 0 && parts[0].trim()) {
            this.addressLine = parts[0].trim();
            this.addressError.set('');
          }
        }

        // 3. City / Town
        if (town) {
          this.city = town;
          this.cityError.set('');
        } else if (pred.secondaryText) {
          const parts = pred.secondaryText.split(',');
          if (parts.length >= 2 && parts[parts.length - 2].trim()) {
            this.city = parts[parts.length - 2].trim();
            this.cityError.set('');
          }
        }

        this.showToast(`Autofilled: ${this.addressLine ? this.addressLine + ', ' : ''}${this.city || ''} ${this.postcode || ''}`);
      },
      error: () => {
        this.searchingAddress.set(false);
        this.searchingPostcode.set(false);
        if (source === 'postcode') {
          this.postcode = pred.mainText || this.postcode;
          this.postcodeError.set('');
        } else {
          this.addressLine = pred.mainText || this.addressLine;
          this.addressError.set('');
        }
      }
    });
  }

  checkUkRestrictedPostcode(rawPostcode: string): { restricted: boolean; region?: string; code?: string } {
    if (!rawPostcode) return { restricted: false };
    const clean = rawPostcode.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (!clean) return { restricted: false };

    // 1. Northern Ireland: All BT prefixes
    if (clean.startsWith('BT')) {
      return { restricted: true, region: 'Northern Ireland (BT)', code: 'BT' };
    }

    // 2. Shetland Islands: All ZE prefixes
    if (clean.startsWith('ZE')) {
      return { restricted: true, region: 'Shetland Islands (ZE)', code: 'ZE' };
    }

    // 3. Scottish Highlands & Islands: All IV, all KW
    if (clean.startsWith('IV')) {
      return { restricted: true, region: 'Scottish Highlands & Islands (IV)', code: 'IV' };
    }
    if (clean.startsWith('KW')) {
      return { restricted: true, region: 'Scottish Highlands & Islands (KW)', code: 'KW' };
    }

    // 4. Channel Islands & Isle of Man: All JE (Jersey), GY (Guernsey), IM (Isle of Man)
    if (clean.startsWith('JE')) {
      return { restricted: true, region: 'Channel Islands (Jersey - JE)', code: 'JE' };
    }
    if (clean.startsWith('GY')) {
      return { restricted: true, region: 'Channel Islands (Guernsey - GY)', code: 'GY' };
    }
    if (clean.startsWith('IM')) {
      return { restricted: true, region: 'Isle of Man (IM)', code: 'IM' };
    }

    // 5. Outward numeric range matching: PA20-80, PH6-50, PO30-41, KA27-28, KY9-10, KY14-16, TD1-8, TD10-14, TR21-25
    const match = clean.match(/^([A-Z]{1,2})(\d{1,2})/);
    if (match) {
      const area = match[1];
      const num = parseInt(match[2], 10);

      // PA20-80 (Scottish Highlands & Islands)
      if (area === 'PA' && num >= 20 && num <= 80) {
        return { restricted: true, region: 'Scottish Highlands & Islands (PA20-PA80)', code: `PA${num}` };
      }

      // PH6-50 (Scottish Highlands & Islands)
      if (area === 'PH' && num >= 6 && num <= 50) {
        return { restricted: true, region: 'Scottish Highlands & Islands (PH6-PH50)', code: `PH${num}` };
      }

      // PO30-41 (Isle of Wight)
      if (area === 'PO' && num >= 30 && num <= 41) {
        return { restricted: true, region: 'Isle of Wight (PO30-PO41)', code: `PO${num}` };
      }

      // KA27-28 (Kilmarnock/Arran)
      if (area === 'KA' && (num === 27 || num === 28)) {
        return { restricted: true, region: 'Offshore Communities (Arran - KA27-28)', code: `KA${num}` };
      }

      // KY9-10, KY14-16 (Kirkcaldy)
      if (area === 'KY' && ((num >= 9 && num <= 10) || (num >= 14 && num <= 16))) {
        return { restricted: true, region: 'Remote Communities (Kirkcaldy - KY9-10, KY14-16)', code: `KY${num}` };
      }

      // TD1-8, TD10-14 (Galashiels)
      if (area === 'TD' && ((num >= 1 && num <= 8) || (num >= 10 && num <= 14))) {
        return { restricted: true, region: 'Remote Communities (Galashiels - TD1-8, TD10-14)', code: `TD${num}` };
      }

      // TR21-25 (Isles of Scilly)
      if (area === 'TR' && num >= 21 && num <= 25) {
        return { restricted: true, region: 'Isles of Scilly (TR21-25)', code: `TR${num}` };
      }
    }

    return { restricted: false };
  }

  onPostcodeInput(event: Event) {
    const input = event.target as HTMLInputElement;
    const raw = (input.value || '').toUpperCase();
    this.postcode = raw;
    this.postcodeError.set('');

    const query = raw.trim();
    if (query.length >= 2) {
      const restricted = this.checkUkRestrictedPostcode(query);
      if (restricted.restricted) {
        this.restrictedPostcodeInfo.set(restricted);
        this.postcodeError.set(`Restricted UK Delivery Area (${restricted.region}). Standard online courier delivery is unavailable.`);
      } else {
        this.restrictedPostcodeInfo.set(null);
      }
    } else {
      this.restrictedPostcodeInfo.set(null);
      this.postcodePredictions.set([]);
      this.showPostcodeDropdown.set(false);
      if (this.postcodeSearchTimer) clearTimeout(this.postcodeSearchTimer);
      return;
    }

    if (this.postcodeSearchTimer) clearTimeout(this.postcodeSearchTimer);
    this.postcodeSearchTimer = setTimeout(() => {
      this.fetchPostcodePredictions(query);
    }, 200);
  }

  onPostcodeFocus() {
    if (this.postcodePredictions().length > 0) {
      this.showPostcodeDropdown.set(true);
    }
  }

  onPostcodeBlur() {
    setTimeout(() => {
      this.showPostcodeDropdown.set(false);
    }, 250);
  }

  onPostcodeKeyDown(event: KeyboardEvent) {
    const preds = this.postcodePredictions();
    if (!this.showPostcodeDropdown() || preds.length === 0) return;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.selectedPostcodeIndex.update(i => (i + 1 < preds.length ? i + 1 : 0));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.selectedPostcodeIndex.update(i => (i - 1 >= 0 ? i - 1 : preds.length - 1));
    } else if (event.key === 'Enter') {
      const idx = this.selectedPostcodeIndex();
      if (idx >= 0 && idx < preds.length) {
        event.preventDefault();
        this.selectAddressPrediction(preds[idx], 'postcode');
      }
    } else if (event.key === 'Escape') {
      this.showPostcodeDropdown.set(false);
    }
  }

  fetchPostcodePredictions(query: string) {
    this.searchingPostcode.set(true);
    const headers = new HttpHeaders({
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': this.googlePlacesApiKey
    });

    const body = {
      input: query,
      includedRegionCodes: ['gb']
    };

    this.http.post<any>('https://places.googleapis.com/v1/places:autocomplete', body, { headers }).subscribe({
      next: (res) => {
        this.searchingPostcode.set(false);
        const suggestions = res?.suggestions || [];
        const mapped: AddressPrediction[] = suggestions.map((s: any) => {
          const p = s.placePrediction;
          return {
            placeId: p.placeId || (p.place ? p.place.replace('places/', '') : ''),
            mainText: p.structuredFormat?.mainText?.text || p.text?.text || '',
            secondaryText: p.structuredFormat?.secondaryText?.text || '',
            fullText: p.text?.text || ''
          };
        }).filter((p: AddressPrediction) => !!p.placeId && !!p.mainText);

        this.postcodePredictions.set(mapped);
        this.showPostcodeDropdown.set(mapped.length > 0);
        this.selectedPostcodeIndex.set(-1);

        const clean = query.replace(/\s+/g, '');
        if (/^[A-Z]{1,2}[0-9][A-Z0-9]?[0-9][A-Z]{2}$/.test(clean) && !this.city.trim()) {
          this.lookupPostcode(query);
        }
      },
      error: () => {
        this.searchingPostcode.set(false);
        this.lookupPostcode(query);
      }
    });
  }

  lookupPostcode(code: string) {
    const clean = (code || '').replace(/\s+/g, '').toUpperCase();
    if (clean.length < 5) return;

    this.lookingUpPostcode.set(true);
    this.http.get<any>(`https://api.postcodes.io/postcodes/${encodeURIComponent(clean)}`).subscribe({
      next: (res) => {
        this.lookingUpPostcode.set(false);
        if (res && res.result) {
          const r = res.result;
          const town = r.parish || r.admin_ward || r.admin_district || r.region || '';
          if (town) {
            this.city = town;
            this.cityError.set('');
            this.showToast(`Found UK location: ${town}`);
          }
          if (r.postcode) {
            this.postcode = r.postcode;
            const check = this.checkUkRestrictedPostcode(r.postcode);
            if (check.restricted) {
              this.restrictedPostcodeInfo.set(check);
              this.postcodeError.set(`Restricted UK Delivery Area (${check.region}). Standard online courier delivery is unavailable.`);
            } else {
              this.restrictedPostcodeInfo.set(null);
            }
          }
        }
      },
      error: () => {
        this.lookingUpPostcode.set(false);
      }
    });
  }

  validateName(): boolean {
    const val = (this.checkoutName || '').trim();
    if (!val) {
      this.nameError.set('Recipient full name is required (*).');
      return false;
    }
    if (val.length < 2 || val.length > 100) {
      this.nameError.set('Full name must be between 2 and 100 characters.');
      return false;
    }
    this.nameError.set('');
    return true;
  }

  validateEmail(): boolean {
    const val = (this.email || '').trim();
    if (!val) {
      this.emailError.set('Email address is required for order tracking & VAT receipt (*).');
      return false;
    }
    const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
    if (!emailRegex.test(val)) {
      this.emailError.set('Please enter a valid email address (e.g. name@example.co.uk).');
      return false;
    }
    this.emailError.set('');
    return true;
  }

  validatePhone(): boolean {
    const raw = (this.checkoutPhone || '').trim();
    if (!raw) {
      this.phoneError.set('Mobile number is required for SMS delivery alerts (*).');
      return false;
    }
    const cleaned = raw.replace(/[\s\-\(\)\.]/g, '');
    const isUkMobile = /^(?:07\d{9}|\+447\d{9})$/.test(cleaned);
    const isIntlPhone = /^\+?[1-9]\d{9,14}$/.test(cleaned);
    if (!isUkMobile && !isIntlPhone) {
      this.phoneError.set('Please enter a valid mobile number (e.g. 07123 456789 or +44 7123 456789).');
      return false;
    }
    this.phoneError.set('');
    return true;
  }

  validateAddress(): boolean {
    const val = (this.addressLine || '').trim();
    if (!val) {
      this.addressError.set('Street address is required (*).');
      return false;
    }
    if (val.length < 3 || val.length > 200) {
      this.addressError.set('Street address must be between 3 and 200 characters.');
      return false;
    }
    this.addressError.set('');
    return true;
  }

  validateCity(): boolean {
    const val = (this.city || '').trim();
    if (!val) {
      this.cityError.set('City / town is required (*).');
      return false;
    }
    if (val.length < 2 || val.length > 50) {
      this.cityError.set('City must be between 2 and 50 characters.');
      return false;
    }
    if (!/^[a-zA-Z\u00C0-\u017F\s\-\'\.]+$/.test(val)) {
      this.cityError.set('Please enter a valid city or town name (letters and hyphens only).');
      return false;
    }
    this.cityError.set('');
    return true;
  }

  validatePostcode(): boolean {
    const val = (this.postcode || '').trim().toUpperCase();
    if (!val) {
      this.postcodeError.set('Postcode is required (*).');
      this.restrictedPostcodeInfo.set(null);
      return false;
    }
    const ukPostcodeRegex = /^([Gg][Ii][Rr]\s?0[Aa]{2})|((([A-Za-z][0-9]{1,2})|(([A-Za-z][A-Ha-hJ-Yj-y][0-9]{1,2})|(([A-Za-z][0-9][A-Za-z])|([A-Za-z][A-Ha-hJ-Yj-y][0-9][A-Za-z]?))))\s?[0-9][A-Za-z]{2})$/;
    const intlPostalRegex = /^[A-Z0-9]{2,4}\s?[A-Z0-9]{2,4}$/i;
    if (!ukPostcodeRegex.test(val) && !intlPostalRegex.test(val)) {
      this.postcodeError.set('Please enter a valid UK postcode (e.g. M1 1AA, SW1A 1AA, EH14 5AN).');
      this.restrictedPostcodeInfo.set(null);
      return false;
    }

    const restricted = this.checkUkRestrictedPostcode(val);
    if (restricted.restricted) {
      this.restrictedPostcodeInfo.set(restricted);
      this.postcodeError.set(
        `Delivery is restricted for ${restricted.region}. Standard online courier delivery is unavailable for this area. Please contact our freight desk on 020 8123 4567 or orders@theheatingandplumbing.co.uk to arrange a bespoke freight quotation.`
      );
      return false;
    }

    this.restrictedPostcodeInfo.set(null);
    this.postcodeError.set('');
    return true;
  }

  validateCardName(): boolean {
    const val = (this.cardName || '').trim();
    if (!val) {
      this.cardNameError.set('Name on card is required (*).');
      return false;
    }
    if (val.length < 2 || val.length > 100) {
      this.cardNameError.set('Cardholder name must be between 2 and 100 characters.');
      return false;
    }
    this.cardNameError.set('');
    return true;
  }

  validateCardNumber(): boolean {
    const digits = (this.cardNumber || '').replace(/[\s\-\•]/g, '');
    if (!digits) {
      this.cardNumberError.set('Card number is required (*).');
      return false;
    }
    if (!/^\d{15,16}$/.test(digits)) {
      this.cardNumberError.set('Card number must be 15 or 16 digits.');
      return false;
    }
    if (digits.startsWith('400000000000') || digits.startsWith('424242424242')) {
      this.cardNumberError.set('');
      return true;
    }
    let sum = 0;
    let shouldDouble = false;
    for (let i = digits.length - 1; i >= 0; i--) {
      let digit = parseInt(digits.charAt(i), 10);
      if (shouldDouble) {
        digit *= 2;
        if (digit > 9) digit -= 9;
      }
      sum += digit;
      shouldDouble = !shouldDouble;
    }
    if (sum % 10 !== 0) {
      this.cardNumberError.set('Card number is invalid (Luhn checksum failed).');
      return false;
    }
    this.cardNumberError.set('');
    return true;
  }

  validateCardExpiry(): boolean {
    const raw = (this.cardExpiry || '').trim().replace(/\s+/g, '');
    if (!raw) {
      this.cardExpiryError.set('Expiry date is required (*).');
      return false;
    }
    const match = raw.match(/^(\d{2})\/?(\d{2})$/);
    if (!match) {
      this.cardExpiryError.set('Expiry date must be MM/YY (e.g. 12/28).');
      return false;
    }
    const month = parseInt(match[1], 10);
    const year = parseInt(match[2], 10);
    if (month < 1 || month > 12) {
      this.cardExpiryError.set('Expiry month must be between 01 and 12.');
      return false;
    }
    const now = new Date();
    const currentYear = now.getFullYear() % 100;
    const currentMonth = now.getMonth() + 1;
    if (year < currentYear || (year === currentYear && month < currentMonth)) {
      this.cardExpiryError.set('Card has expired. Please enter an active expiry date.');
      return false;
    }
    this.cardExpiryError.set('');
    return true;
  }

  validateCardCvc(): boolean {
    const digits = (this.cardCvc || '').trim();
    if (!digits) {
      this.cardCvcError.set('Security code (CVC) is required (*).');
      return false;
    }
    if (!/^\d{3,4}$/.test(digits)) {
      this.cardCvcError.set('CVC must be 3 or 4 digits.');
      return false;
    }
    this.cardCvcError.set('');
    return true;
  }

  validateTerms(): boolean {
    if (!this.termsAccepted) {
      this.termsError.set('Please accept the Terms of Sale to proceed (*).');
      return false;
    }
    this.termsError.set('');
    return true;
  }

  // Customer Address Book (Per-user storage, empty by default for new users)
  get addressStorageKey(): string {
    const emailKey = (this.email || localStorage.getItem('email') || '').trim().toLowerCase();
    return emailKey ? `thp_addresses_${emailKey}` : 'thp_addresses_guest';
  }
  savedAddresses = signal<SavedAddress[]>([]);
  selectedAddressId = signal<string>('');
  isAddingAddress = signal(false);
  newAddressLabel = '';
  newAddressName = '';
  newAddressPhone = '';
  newAddressLine = '';
  newAddressCity = '';
  newAddressPostcode = '';

  // Order Tracking Modal & Guest Lookup
  trackingOrder = signal<Order | null>(null);
  trackLookupModalOpen = signal(false);
  trackLookupQuery = '';
  trackLookupLoading = signal(false);
  trackLookupError = signal('');

  // Dynamic CMS Content & Announcement Banners
  announcementBanner = signal('Over 14,000 Verified UK Reviews • Free UK Delivery on orders over £500 • 20-Year Guarantee Protection');
  activeCmsModal = signal<{title: string, body: string, seoTitle?: string, pdfUrl?: string, pdfFilename?: string} | null>(null);

  // Floating Support / WhatsApp Widget & Complaint Claims
  supportWidgetOpen = signal(false);
  supportWidgetTab = signal<'callback' | 'claim' | 'track'>('callback');
  trackingTicketInput = signal('TKT-2026-33885');
  trackingTicketResult = signal<any>(null);
  trackingTicketLoading = signal(false);
  trackingTicketError = signal('');
  supportQueryName = '';
  supportQueryEmail = '';
  supportQueryPhone = '';
  supportQueryOrderNumber = '';
  supportQueryProduct = '';
  supportQueryCategory = 'Damaged in Delivery';
  supportQueryMessage = '';
  supportAttachmentUrl = signal('');
  supportAttachmentFilename = signal('');
  supportUploading = signal(false);
  supportSubmitted = signal(false);
  lastSubmittedTicket = signal<{ticketNumber: string, status: string, message: string} | null>(null);

  // Customer Account Support Tickets
  customerTickets = signal<any[]>([]);
  loadingCustomerTickets = signal(false);

  // Social Media Channels (Configurable links for brand pages)
  socialLinks = {
    facebook: 'https://www.facebook.com/share/1CPi7d3YxZ/',
    instagram: 'https://www.instagram.com/theheatingandplumbing?srtk=eGt6ZGhmZGcwajU1',
    tiktok: 'https://www.tiktok.com/@theheatingandplumbing',
    x: 'https://x.com/theheatingandplumbing',
    pinterest: 'https://pinterest.com/theheatingandplumbing'
  };

  loadSocialLinks() {
    this.http.get<any>('/api/settings/social').subscribe({
      next: (data) => {
        if (data && typeof data === 'object') {
          this.socialLinks = { ...this.socialLinks, ...data };
        }
      },
      error: () => {}
    });
  }

  newsletterEmail = signal('');
  subscribeNewsletter() {
    const email = this.newsletterEmail().trim();
    if (email && email.includes('@')) {
      this.showToast('Thank you for subscribing to THP design & heating updates.');
      this.newsletterEmail.set('');
    } else {
      this.showToast('Please enter a valid email address.');
    }
  }

  scrollToTop() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // Multi-Level Hierarchical Navigation Configuration (Reference: Heat & Plumb / BestHeating)
  navigationMenu: NavParentMenu[] = [
    {
      id: 'bathroom-suites',
      title: 'Bathroom Suites',
      category: 'Bathrooms',
      icon: '🛁',
      badge: '',
      imageUrl: '/api/product-images/2a19631f-69b4-404a-8fa2-49cdc0dbed53.jpg',
      description: 'Transform your bathroom with luxury heated towel warmers, mirror radiators, dual fuel all-season heating kits, and precision chrome & black valves.',
      filterOptions: {
        showPriceFilter: true,
        showAvailabilityFilter: true,
        showBrandFilter: true,
        showColourFilter: true,
        showBtuFilter: false,
        showPanelTypeFilter: false,
        showHeightFilter: false,
        showFuelTypeFilter: false,
        subcategoryHeading: 'Bathroom Styles & Types',
        subcategories: [
          { label: 'Alex Multi-Rail Heated Warmer', query: 'Alex' },
          { label: 'Rolo-Mirror Integrated Radiators', query: 'Rolo-Mirror' },
          { label: 'Dual Fuel Conversion Kits', query: 'Dual Fuel' },
          { label: 'Retro Period Warmers', query: 'Retro' },
          { label: 'All Bathroom Towel Rails', query: 'Heated Towel Rails' }
        ]
      },
      columns: [
        {
          title: 'Designer Heated Rails',
          items: [
            { label: 'Alex Multi-Rail Heated Warmer', query: 'Alex', badge: 'BESTSELLER' },
            { label: 'Dexter Contemporary Rails', query: 'Dexter', badge: 'POPULAR' },
            { label: 'Easy Slimline Compact Rails', query: 'Easy', badge: 'SPACE SAVER' },
            { label: 'Fiona Elegant Towel Rails', query: 'Fiona' },
            { label: 'All Bathroom Towel Rails', category: 'Heated Towel Rails' }
          ]
        },
        {
          title: 'Luxury & Period Warmers',
          items: [
            { label: 'Retro Traditional Heated Rails', query: 'Retro', badge: 'PERIOD' },
            { label: 'Salisbury Heritage Towel Rails', query: 'Salisbury' },
            { label: 'Quadrus Bold Statement Rails', query: 'Quadrus' },
            { label: 'Vivo & Zig Zag Architectural Rails', query: 'Zig Zag', badge: 'DESIGNER' },
            { label: 'Crystal Architectural Rails', query: 'Crystal' }
          ]
        },
        {
          title: 'Bathroom Radiators & Dual Fuel',
          items: [
            { label: 'Rolo-Mirror Integrated Radiators', query: 'Rolo-Mirror', badge: 'WITH MIRROR' },
            { label: 'Warp S & T Bold Warmers', query: 'Warp' },
            { label: 'Dual Fuel Conversion Kits', query: 'Dual Fuel', badge: 'ALL-SEASON' },
            { label: 'Thermostatic Chrome & Black TRVs', query: 'Corner' },
            { label: 'Complete Bathroom Heating Collection', category: 'Bathrooms' }
          ]
        }
      ],
      featuredPromo: {
        tag: 'LUXURY BATHROOM HEATING',
        title: 'Alex Multi-Rail Towel Warmer',
        subtitle: 'Engineered for rapid towel drying, high thermal output, and durable corrosion-resistant finish.',
        cta: 'Explore Bathroom Warmers →',
        category: 'Bathrooms',
        query: 'Alex',
        imageUrl: '/api/product-images/2a19631f-69b4-404a-8fa2-49cdc0dbed53.jpg'
      }
    },
    {
      id: 'radiators',
      title: 'Radiators',
      category: 'Radiators',
      icon: '🔥',
      badge: '',
      description: 'Discover our extensive collection of high-efficiency convector radiators, column radiators, and designer flat panels engineered to keep British homes warm.',
      filterOptions: {
        showPriceFilter: true,
        showAvailabilityFilter: true,
        showBrandFilter: true,
        showColourFilter: true,
        showBtuFilter: true,
        showPanelTypeFilter: true,
        showHeightFilter: true,
        showFuelTypeFilter: false,
        subcategoryHeading: 'Panel Types & Styles',
        subcategories: [
          { label: 'Type 22 Double Convector (DF)', query: 'DF' },
          { label: 'Type 11 Single Convector (SF)', query: 'SF' },
          { label: 'Type 21 Double-Single (HF)', query: 'HF' },
          { label: 'Compact 6 DS (Multi-Port)', query: 'DS' },
          { label: 'Compact 6 TS (Triple Panel)', query: 'TS' },
          { label: 'Colorado Column Radiators', query: 'Colorado' },
          { label: 'Bergamo Sectional Radiators', query: 'Bergamo' }
        ]
      },
      columns: [
        {
          title: 'Convector Panel Types',
          items: [
            { label: 'Type 22 Double Convector (DF)', query: 'DF', badge: 'BESTSELLER' },
            { label: 'Type 11 Single Convector (SF)', query: 'SF', badge: 'SLIMLINE' },
            { label: 'Type 21 Double-Single (HF)', query: 'HF' },
            { label: 'Compact 6 DS (Multi-Port Double)', query: 'DS', badge: '6-TAPPING' },
            { label: 'Compact 6 TS (Triple High Output)', query: 'TS', badge: 'TYPE 33' },
            { label: 'Compact 6 QS (Quad Maximum Density)', query: 'QS', badge: 'TYPE 44' },
            { label: 'All Convector Radiators', category: 'Radiators' }
          ]
        },
        {
          title: 'Designer & Column Radiators',
          items: [
            { label: 'Colorado Multi-Column Radiators', query: 'Colorado', badge: 'BESTSELLER' },
            { label: 'Bergamo Sectional Radiators', query: 'Bergamo' },
            { label: 'Forte Double & Single Panels', query: 'Forte', badge: 'MODERN' },
            { label: 'Angus Architectural Radiators', query: 'Angus' },
            { label: 'Hex Geometric Statement Radiators', query: 'Hex', badge: 'LUXURY' },
            { label: 'Nemo & Ribbon Designer Series', query: 'Nemo' }
          ]
        },
        {
          title: 'Heights & Sizing',
          items: [
            { label: '300mm & 400mm Low-Level Radiators', query: '300' },
            { label: '500mm & 600mm Standard Height', query: '600' },
            { label: '700mm High Output Panels', query: '700' },
            { label: '1800mm Tall Vertical Radiators', query: '1800' },
            { label: 'All Radiator Collections', category: 'Radiators' }
          ]
        }
      ],
      featuredPromo: {
        tag: 'BENCHMARK PERFORMANCE',
        title: 'Compact 4 DF Horizontal Radiator',
        subtitle: 'High output double convector panel radiator with factory-fitted top grilles and 10-year warranty.',
        cta: 'Shop Compact 4 Series →',
        category: 'Radiators',
        query: 'DF',
        imageUrl: '/api/product-images/610be977-0784-40d1-a857-edc5e78bc884.png'
      }
    },
    {
      id: 'towel-rails',
      title: 'Heated Towel Rails',
      category: 'Heated Towel Rails',
      icon: '🛁',
      badge: '',
      description: 'Enhance your bathroom with our premium heated towel rails and ladder warmers. Designed for optimal heat output, cozy warm towels, and corrosion-resistant finishes.',
      filterOptions: {
        showPriceFilter: true,
        showAvailabilityFilter: true,
        showBrandFilter: true,
        showColourFilter: true,
        showBtuFilter: true,
        showPanelTypeFilter: false,
        showHeightFilter: true,
        showFuelTypeFilter: true,
        subcategoryHeading: 'Towel Rail Styles',
        subcategories: [
          { label: 'Alex Classic Multi-Rail', query: 'Alex' },
          { label: 'Easy Slimline Compact', query: 'Easy' },
          { label: 'Fiona Pristine Rails', query: 'Fiona' },
          { label: 'Dexter Modern Warmers', query: 'Dexter' },
          { label: 'Zig Zag Statement Rails', query: 'Zig Zag' },
          { label: 'Retro Period Rails', query: 'Retro' }
        ]
      },
      columns: [
        {
          title: 'Ladder & Bathroom Rails',
          items: [
            { label: 'Alex Classic Multi-Rail Warmers', query: 'Alex', badge: 'POPULAR' },
            { label: 'Easy Slimline Compact Rails', query: 'Easy', badge: 'SLIMLINE' },
            { label: 'Fiona Pristine Ladder Rails', query: 'Fiona' },
            { label: 'Crystal Architectural Rails', query: 'Crystal' },
            { label: 'All Heated Towel Rails', category: 'Heated Towel Rails' }
          ]
        },
        {
          title: 'Designer & Architectural Rails',
          items: [
            { label: 'Dexter Contemporary Towel Rails', query: 'Dexter', badge: 'MODERN' },
            { label: 'Zig Zag Architectural Rails', query: 'Zig Zag', badge: 'DESIGNER' },
            { label: 'Vivo Clean-Line Warmers', query: 'Vivo' },
            { label: 'Quadrus Bold Square Profile', query: 'Quadrus' },
            { label: 'Michelle & Jade Curved Rails', query: 'Michelle' }
          ]
        },
        {
          title: 'Heritage & Towel Sizes',
          items: [
            { label: 'Retro Period Towel Warmers', query: 'Retro', badge: 'PERIOD' },
            { label: 'Salisbury Luxury Period Rails', query: 'Salisbury' },
            { label: 'Warp S & T Bold Warmers', query: 'Warp' },
            { label: 'Compact 600mm - 860mm Rails', query: '800' },
            { label: 'Tall 1200mm - 1800mm Rails', query: '1600' }
          ]
        }
      ],
      featuredPromo: {
        tag: 'BATHROOM LUXURY',
        title: 'Alex Heated Ladder Towel Rail',
        subtitle: 'Pristine Traffic White multi-rail ladder warmer engineered for rapid towel drying and ambient warmth.',
        cta: 'Explore Towel Rails →',
        category: 'Heated Towel Rails',
        query: 'Alex',
        imageUrl: '/api/product-images/325c65f7-c7eb-4da9-b4e1-8a150483c9e5.jpg'
      }
    },
    {
      id: 'electric-heating',
      title: 'Electric Heating',
      category: 'Electric Heating',
      icon: '⚡',
      badge: '',
      description: 'Smart electric radiators, pre-filled electric towel warmers, and digital WiFi heating elements providing precision temperature control and energy efficiency.',
      filterOptions: {
        showPriceFilter: true,
        showAvailabilityFilter: true,
        showBrandFilter: true,
        showColourFilter: true,
        showBtuFilter: true,
        showPanelTypeFilter: false,
        showHeightFilter: true,
        showFuelTypeFilter: false,
        subcategoryHeading: 'Electric Heating Types',
        subcategories: [
          { label: 'Colorado WiFi Smart Radiators', query: 'Colorado' },
          { label: 'Alex One Electric Towel Rails', query: 'Alex One' },
          { label: 'KTX-4 Smart WiFi Elements', query: 'KTX' },
          { label: 'MOA Digital Elements', query: 'MOA' },
          { label: 'Terma SS1 Split Probes', query: 'Probe' }
        ]
      },
      columns: [
        {
          title: 'Smart Electric Radiators',
          items: [
            { label: 'Colorado WiFi Smart Electric Radiators', query: 'Colorado', badge: 'WIFI APP' },
            { label: 'Bergamo WiFi Digital Convectors', query: 'Bergamo', badge: 'DIGITAL TIMER' },
            { label: 'Rolo-Room E Smart Radiators', query: 'Rolo-Room', badge: 'BLUETOOTH' },
            { label: 'Warp Room E Electric Panels', query: 'Warp' },
            { label: 'All Electric Heating', category: 'Electric Heating' }
          ]
        },
        {
          title: 'Electric Heated Towel Rails',
          items: [
            { label: 'Alex One Factory Electric Rails', query: 'Alex One', badge: 'PRE-FILLED' },
            { label: 'Dexter E Electric Designer Rails', query: 'Dexter E' },
            { label: 'Easy One Compact Electric Warmers', query: 'Easy One' },
            { label: 'Leo E Pre-Filled Electric Rails', query: 'Leo E' },
            { label: 'Zig Zag Electric Statement Rails', query: 'Zig Zag' }
          ]
        },
        {
          title: 'Heating Elements & Probes',
          items: [
            { label: 'KTX-4 Blue WiFi Smart Elements', query: 'KTX', badge: 'SMART WIFI' },
            { label: 'MOA & MOA Blue Digital Elements', query: 'MOA' },
            { label: 'MEG Thermostatic Element Range', query: 'MEG' },
            { label: 'Terma SS1 Smart Split Probes (120W-2000W)', query: 'Probe', badge: 'RAPID HEAT' }
          ]
        }
      ],
      featuredPromo: {
        tag: 'SMART HEATING EFFICIENCY',
        title: 'Colorado WiFi Smart Electric Radiator',
        subtitle: 'Precision WiFi app control, 7-day digital scheduling, and high thermal retention ceramic column core.',
        cta: 'Shop Electric Heating →',
        category: 'Electric Heating',
        query: 'Colorado',
        imageUrl: '/api/product-images/fc274807-bc10-4063-b29c-c8bde1f7dd00.png'
      }
    },
    {
      id: 'valves',
      title: 'Valves & Accessories',
      category: 'Valves & Accessories',
      icon: '⚙',
      badge: '',
      description: 'Precision thermostatic radiator valves (TRVs), 50mm twin valve sets, solid brass pipe finishing sleeves, and dual fuel conversion kits.',
      filterOptions: {
        showPriceFilter: true,
        showAvailabilityFilter: true,
        showBrandFilter: true,
        showColourFilter: true,
        showBtuFilter: false,
        showPanelTypeFilter: false,
        showHeightFilter: false,
        showFuelTypeFilter: false,
        subcategoryHeading: 'Valve & Fitting Types',
        subcategories: [
          { label: 'Corner 3-Axis TRV Sets', query: 'Corner' },
          { label: 'Traditional Vintage TRVs', query: 'Traditional' },
          { label: '50mm Twin Valve Sets', query: 'Twins' },
          { label: 'Solid Brass Pipe Sleeves', query: 'Pipe Masking' },
          { label: 'Dual Fuel T-Piece Kits', query: 'T-Piece' }
        ]
      },
      columns: [
        {
          title: 'Precision TRV Valves',
          items: [
            { label: 'Cylindrical 3-Axis Corner TRVs', query: 'Cylindrical', badge: '3-AXIS BESTSELLER' },
            { label: 'Traditional Vintage TRV Sets', query: 'Traditional', badge: 'ANTIQUE' },
            { label: 'Vario Twins 50mm Integrated Sets', query: 'Twins', badge: '50MM PIPING' },
            { label: 'Vario Vision Architectural TRVs', query: 'Vision' },
            { label: 'All Radiator Valves', category: 'Valves & Accessories' }
          ]
        },
        {
          title: 'Pipe Finishing & Sleeves',
          items: [
            { label: 'Solid Brass Pipe Masking Sleeves', query: 'Pipe Masking', badge: 'MATCHING SLEEVES' },
            { label: 'Polished Chrome Pipe Shrouds', query: 'Chrome' },
            { label: 'Matt Textured Black Pipe Finishing', query: 'Black' },
            { label: 'Antique Brass & Copper Sleeves', query: 'Brass' }
          ]
        },
        {
          title: 'Dual Fuel & Components',
          items: [
            { label: 'Dual Fuel T-Piece Adapters', query: 'T-Piece', badge: 'ALL-SEASON' },
            { label: 'Vario Integra TRV with Integrated T-Piece', query: 'Integra' },
            { label: 'Heavy Duty Wall Fixing Brackets', query: 'Accessory' },
            { label: 'Heating Element Controllers', query: 'Element' }
          ]
        }
      ],
      featuredPromo: {
        tag: 'ARCHITECTURAL FINISH',
        title: 'TRV Corner 3-Axis Valve Set',
        subtitle: 'Precision thermostatic radiator valve set positioning the sensor parallel to the wall for a sleek profile.',
        cta: 'Browse Valves & Kits →',
        category: 'Valves & Accessories',
        query: 'Corner',
        imageUrl: '/api/product-images/65301fc2-1bf1-4cff-b046-589de5422312.jpg'
      }
    },
    {
      id: 'sale',
      title: 'SALE',
      category: 'SALE',
      icon: '🏷',
      badge: 'HOT',
      description: 'Unbeatable seasonal deals with up to 40% off clearance radiators, heated towel rails, and ex-display heating sets.',
      filterOptions: {
        showPriceFilter: true,
        showAvailabilityFilter: true,
        showBrandFilter: true,
        showColourFilter: true,
        showBtuFilter: true,
        showPanelTypeFilter: true,
        showHeightFilter: true,
        showFuelTypeFilter: false,
        subcategoryHeading: 'Clearance Categories',
        subcategories: [
          { label: 'Convector Radiator Deals', query: 'DF' },
          { label: 'Colorado Column Reductions', query: 'Colorado' },
          { label: 'Towel Rail Clearance', query: 'Alex' },
          { label: 'TRV Valve Deals', query: 'Cylindrical' },
          { label: 'Under £150 Specials', query: 'Compact' }
        ]
      },
      columns: [
        {
          title: 'Clearance Radiators',
          items: [
            { label: 'Convector Radiator Special Deals', query: 'DF', badge: 'UP TO 40% OFF' },
            { label: 'Colorado Column Radiator Reductions', query: 'Colorado' },
            { label: 'All Sale Radiators', category: 'Radiators' }
          ]
        },
        {
          title: 'Towel Rail & Valve Offers',
          items: [
            { label: 'Ladder Towel Warmer Clearance', query: 'Alex', badge: 'PRICE DROP' },
            { label: 'Designer TRV Valve Set Deals', query: 'Cylindrical' },
            { label: 'All Sale Items', category: 'SALE' }
          ]
        },
        {
          title: 'Exclusive Promotions',
          items: [
            { label: 'Under £150 Heating Specials', query: 'Compact' },
            { label: 'Electric Heating Clearance', query: 'Electric' },
            { label: 'Full Overstock Clearance', category: 'SALE' }
          ]
        }
      ],
      featuredPromo: {
        tag: 'SEASONAL CLEARANCE',
        title: 'Up To 40% Off Radiators & Rails',
        subtitle: 'Factory-direct overstock discounts on premium British and European central heating and towel warmers.',
        cta: 'Shop All Sale Items →',
        category: 'SALE',
        imageUrl: '/api/product-images/610be977-0784-40d1-a857-edc5e78bc884.png'
      }
    }
  ];

  dynamicNavigationMenu = signal<NavParentMenu[]>(this.navigationMenu);

  activeMenuFilterOptions = computed(() => {
    const cat = this.category;
    const menus = this.dynamicNavigationMenu();
    let active = cat ? menus.find(m => this.categoryMatches(m.category, cat)) : null;
    if (!active && menus.length > 0) {
      active = menus.find(m => m.category === 'Radiators') || menus[0];
    }
    const isRadiator = !cat || cat.toLowerCase().includes('radiator');
    const isTowel = !!(cat && (cat.toLowerCase().includes('towel') || cat.toLowerCase().includes('rail')));
    const isElectric = !!(cat && (cat.toLowerCase().includes('electric') || cat.toLowerCase().includes('heater')));
    const isValves = !!(cat && (cat.toLowerCase().includes('valve') || cat.toLowerCase().includes('accessor')));
    const isBath = !!(cat && (cat.toLowerCase().includes('bath') || cat.toLowerCase().includes('suite')));

    const defaultCustomFilters = isRadiator
      ? [
          { name: 'Orientation', optionsStr: 'Horizontal, Vertical', options: ['Horizontal', 'Vertical'] },
          { name: 'Material', optionsStr: 'Mild Steel, Aluminium', options: ['Mild Steel', 'Aluminium'] }
        ]
      : (isTowel || isBath
          ? [{ name: 'Orientation', optionsStr: 'Vertical, Horizontal', options: ['Vertical', 'Horizontal'] }]
          : (isValves
              ? [{ name: 'Valve Angle', optionsStr: 'Angled, Straight, Corner', options: ['Angled', 'Straight', 'Corner'] }]
              : (isElectric
                  ? [{ name: 'Heating Technology', optionsStr: 'WiFi Smart App, Digital Timer, Pre-Filled', options: ['WiFi Smart App', 'Digital Timer', 'Pre-Filled'] }]
                  : [])));

    if (active && active.filterOptions) {
      const opts = { ...active.filterOptions };
      if (!opts.customFilters || opts.customFilters.length === 0) {
        opts.customFilters = defaultCustomFilters;
      }
      return opts;
    }

    return {
      showPriceFilter: true,
      showAvailabilityFilter: true,
      showBrandFilter: true,
      showColourFilter: true,
      showBtuFilter: isRadiator || isTowel || isElectric,
      showPanelTypeFilter: isRadiator,
      showHeightFilter: isRadiator || isTowel || isElectric,
      showFuelTypeFilter: isTowel,
      subcategoryHeading: isBath ? 'Bathroom Styles & Types' : (isValves ? 'Valve & Fitting Types' : (isRadiator ? 'Panel Types & Styles' : 'Styles & Types')),
      subcategories: [],
      customFilters: defaultCustomFilters
    };
  });

  activeDepartmentMenu = computed(() => {
    const cat = this.category;
    if (!cat) return null;
    const menus = this.dynamicNavigationMenu();
    return menus.find(m => this.categoryMatches(m.category, cat)) || null;
  });

  availableBrandsForCurrentCategory = computed(() => {
    const cat = this.category;
    const prods = this.products().filter(p => !cat || this.categoryMatches(p.category, cat));
    const set = new Set<string>();
    prods.forEach(p => { if (p.brand && p.brand.trim()) set.add(p.brand.trim()); });
    return Array.from(set).sort();
  });

  // Swatch colour definitions
  swatchList = [
    { name: 'Anthracite', label: 'Anthracite Grey', hex: '#282a2e' },
    { name: 'White', label: 'Pure White', hex: '#ffffff', border: true },
    { name: 'Brass', label: 'Brushed Brass', hex: '#c5a059' },
    { name: 'Chrome', label: 'Polished Chrome', hex: '#d1d5db' },
    { name: 'Black', label: 'Matt Black', hex: '#111827' }
  ];

  private inMemoryAuth = signal<string | null>(null);

  get sessionAuth(): string | null {
    return this.inMemoryAuth();
  }

  // Dynamic Facet Options
  availableCategories = computed(() => {
    const counts: Record<string, number> = {};
    for (const p of this.products()) {
      const c = p.category || 'Other';
      counts[c] = (counts[c] || 0) + 1;
    }
    return Object.entries(counts).map(([name, count]) => ({ name, count }));
  });

  availableBrands = computed(() => {
    const counts: Record<string, number> = {};
    for (const p of this.products()) {
      const b = p.brand || 'THP Heating';
      counts[b] = (counts[b] || 0) + 1;
    }
    return Object.entries(counts).map(([name, count]) => ({ name, count }));
  });

  categoryMatches(prodCat: string, filterCat: string): boolean {
    if (!prodCat || !filterCat) return true;
    if (prodCat.toLowerCase() === filterCat.toLowerCase()) return true;
    const p = prodCat.toLowerCase();
    const f = filterCat.toLowerCase().trim();

    // Sale / Clearance / Deals
    if (f === 'sale' || f.includes('clearance') || f.includes('deal') || f.includes('offer')) {
      return true;
    }
    // Radiators & Convectors
    if (f === 'radiators' || f === 'all radiators' || f.includes('radiator') || f.includes('convector')) {
      return p.includes('radiator') || p.includes('convector');
    }
    // Heated Towel Rails
    if (f.includes('towel') || f.includes('rail') || f.includes('warmer')) {
      return p.includes('towel');
    }
    // Electric Heating (Electric Radiators, Towel Rails, Heating Elements)
    if (f.includes('electric') || f.includes('element') || f.includes('heater')) {
      return p.includes('electric') || p.includes('element');
    }
    // Valves & Accessories
    if (f.includes('valve') || f.includes('accessor') || f.includes('trv') || f.includes('fitting')) {
      return p.includes('valve') || p.includes('accessori') || p.includes('accessory');
    }
    // Bathrooms / Bathroom Suites
    if (f.includes('bath') || f.includes('suite') || f.includes('sanitary')) {
      return p.includes('towel') || p.includes('accessori') || p.includes('valve') || p.includes('radiator');
    }
    // Showers & Enclosures
    if (f.includes('shower') || f.includes('enclosure') || f.includes('wetroom')) {
      return p.includes('towel') || p.includes('accessori');
    }
    // Furniture / Basins
    if (f.includes('furn') || f.includes('basin') || f.includes('vanity') || f.includes('mirror')) {
      return p.includes('radiator') || p.includes('towel');
    }
    // Taps & Brassware
    if (f.includes('tap') || f.includes('brass')) {
      return p.includes('valve') || p.includes('accessori');
    }
    // Plumbing / Renewables
    if (f.includes('plumb') || f.includes('renew') || f.includes('underfloor')) {
      return p.includes('valve') || p.includes('accessori') || p.includes('radiator');
    }

    return p.includes(f) || f.includes(p);
  }

  productMatchesActiveFilters(p: Product, ignorePrice = false): boolean {
    // 1. Primary Category Filter
    if (this.category && !this.categoryMatches(p.category, this.category)) {
      return false;
    }

    // 2. Multi-Select Categories Facet
    if (this.selectedCategories().length > 0 && !this.selectedCategories().some(sc => this.categoryMatches(p.category, sc))) {
      return false;
    }

    // 3. Subcategory Filter
    if (this.selectedSubcategory()) {
      const sub = this.selectedSubcategory().toLowerCase().trim();
      const variantText = (p.variants || []).map(v => `${v.panel || ''} ${v.colour || ''} ${v.variantSku || ''} ${v.heightMm || ''}mm ${v.widthMm || ''}mm`).join(' ');
      const text = `${p.name} ${p.category} ${p.description || ''} ${p.brand || ''} ${p.sku || ''} ${variantText}`.toLowerCase();
      
      let matches = text.includes(sub);
      if (!matches) {
        if (sub === 'df' || sub.includes('type 22') || sub.includes('double convector')) {
          matches = text.includes('df') || text.includes('type 22') || text.includes('double convector') || text.includes('double panel') || text.includes('2 column') || text.includes('double');
        } else if (sub === 'sf' || sub.includes('type 11') || sub.includes('single convector')) {
          matches = text.includes('sf') || text.includes('type 11') || text.includes('single convector') || text.includes('single panel') || text.includes('single');
        } else if (sub === 'hf' || sub.includes('type 21') || sub.includes('double-single')) {
          matches = text.includes('hf') || text.includes('type 21') || text.includes('double-single');
        } else if (sub === 'ds' || sub.includes('compact 6') || sub.includes('multi-port')) {
          matches = text.includes('ds') || text.includes('compact 6') || text.includes('multi-port');
        } else if (sub === 'ts' || sub.includes('type 33') || sub.includes('triple')) {
          matches = text.includes('ts') || text.includes('type 33') || text.includes('triple');
        } else if (sub === 'qs' || sub.includes('type 44') || sub.includes('quad')) {
          matches = text.includes('qs') || text.includes('type 44') || text.includes('quad');
        } else if (sub.includes('colorado') || sub.includes('column')) {
          matches = text.includes('colorado') || text.includes('column');
        } else if (sub.includes('bergamo')) {
          matches = text.includes('bergamo');
        } else if (sub.includes('forte')) {
          matches = text.includes('forte');
        } else if (sub.includes('angus')) {
          matches = text.includes('angus');
        } else if (sub.includes('hex')) {
          matches = text.includes('hex');
        } else if (sub.includes('nemo')) {
          matches = text.includes('nemo');
        } else if (sub.includes('ribbon')) {
          matches = text.includes('ribbon');
        } else if (sub.includes('alex')) {
          matches = text.includes('alex');
        } else if (sub.includes('dexter')) {
          matches = text.includes('dexter');
        } else if (sub.includes('easy')) {
          matches = text.includes('easy');
        } else if (sub.includes('fiona')) {
          matches = text.includes('fiona');
        } else if (sub.includes('crystal')) {
          matches = text.includes('crystal');
        } else if (sub.includes('retro')) {
          matches = text.includes('retro');
        } else if (sub.includes('quadrus')) {
          matches = text.includes('quadrus');
        } else if (sub.includes('salisbury')) {
          matches = text.includes('salisbury');
        } else if (sub.includes('vivo')) {
          matches = text.includes('vivo');
        } else if (sub.includes('warp')) {
          matches = text.includes('warp');
        } else if (sub.includes('zig zag') || sub.includes('zigzag')) {
          matches = text.includes('zig zag') || text.includes('zigzag');
        } else if (sub.includes('rolo')) {
          matches = text.includes('rolo');
        } else if (sub.includes('trv') || sub.includes('valve')) {
          matches = text.includes('valve') || text.includes('trv');
        } else if (sub.includes('corner') || sub.includes('3-axis')) {
          matches = text.includes('corner') || text.includes('3-axis');
        } else if (sub.includes('angled')) {
          matches = text.includes('angled');
        } else if (sub.includes('twin')) {
          matches = text.includes('twin');
        } else if (sub.includes('element') || sub.includes('probe')) {
          matches = text.includes('element') || text.includes('probe') || text.includes('ktx') || text.includes('moa') || text.includes('meg') || text.includes('sim');
        } else if (sub.includes('wifi') || sub.includes('smart') || sub.includes('bluetooth')) {
          matches = text.includes('wifi') || text.includes('bluetooth') || text.includes('smart') || text.includes('blue');
        } else if (sub.includes('t-piece') || sub.includes('dual fuel')) {
          matches = text.includes('t-piece') || text.includes('dual fuel') || text.includes('integra');
        } else if (sub.includes('pipe') || sub.includes('sleeve') || sub.includes('shroud') || sub.includes('masking')) {
          matches = text.includes('masking') || text.includes('pipe') || text.includes('sleeve') || text.includes('shroud');
        } else if (sub.includes('bracket') || sub.includes('fitting') || sub.includes('accessory')) {
          matches = text.includes('bracket') || text.includes('accessory') || text.includes('hanger');
        } else {
          const tokens = sub.split(/\s+/).filter(t => t.length > 2);
          matches = tokens.some(tok => text.includes(tok));
        }
      }
      if (!matches) return false;
    }

    // 3b. Custom Dynamic Filters Facet (e.g. Orientation, Material, Valve Style)
    const customFilters = this.selectedCustomFilters();
    for (const [groupName, option] of Object.entries(customFilters)) {
      if (!option) continue;
      const optLower = option.toLowerCase().trim();
      const variantText = (p.variants || []).map(v => `${v.panel || ''} ${v.colour || ''} ${v.variantSku || ''}`).join(' ');
      const text = `${p.name} ${p.category} ${p.description || ''} ${p.brand || ''} ${p.sku || ''} ${variantText} ${(p as any).specificationsJson || ''}`.toLowerCase();
      
      let matches = text.includes(optLower);
      if (!matches) {
        const tokens = optLower.split(/\s+/).filter(t => t.length > 2);
        matches = tokens.length > 0 && tokens.every(tok => text.includes(tok));
      }
      if (!matches) return false;
    }

    // 4. Price Bounds
    if (!ignorePrice) {
      const price = this.displayPrice(p);
      if (price < this.minPrice() || price > this.maxPrice()) {
        return false;
      }
    }

    // 5. In Stock Only Facet
    if (this.inStockOnly() && p.stock <= 0) {
      return false;
    }

    // 6. Colour / Finish Multi-Select Facet
    if (this.selectedColours().length > 0) {
      const prodColours = this.colours(p).map(c => c.toLowerCase());
      const matchesColour = this.selectedColours().some(sc =>
        prodColours.some(pc => pc.includes(sc.toLowerCase()))
      );
      if (!matchesColour) return false;
    }

    // 7. Brand Multi-Select Facet
    if (this.selectedBrands().length > 0) {
      const brand = (p.brand || '').toLowerCase();
      const matchesBrand = this.selectedBrands().some(sb => brand.includes(sb.toLowerCase()));
      if (!matchesBrand) return false;
    }

    // 8. BTU Heat Output Range Facet
    const btu = p.btu || 0;
    const btuRange = this.btuRange();
    if (btuRange === 'under2k' && (btu <= 0 || btu >= 2000)) return false;
    if (btuRange === '2k-4k' && (btu < 2000 || btu > 4000)) return false;
    if (btuRange === '4k-6k' && (btu < 4000 || btu > 6000)) return false;
    if (btuRange === 'over6k' && btu < 6000) return false;

    return true;
  }

  // Faceted Filtering Engine
  filtered = computed(() => {
    return this.products().filter(p => this.productMatchesActiveFilters(p, false));
  });

  // Sorting Engine
  sorted = computed(() => {
    const list = [...this.filtered()];
    const s = this.sort();
    if (s === 'low') return list.sort((a, b) => this.displayPrice(a) - this.displayPrice(b));
    if (s === 'high') return list.sort((a, b) => this.displayPrice(b) - this.displayPrice(a));
    if (s === 'stock') return list.sort((a, b) => b.stock - a.stock);
    if (s === 'btu') return list.sort((a, b) => (b.btu || 0) - (a.btu || 0));
    if (s === 'rating') return list.sort((a, b) => b.id - a.id);
    return list.sort((a, b) => (this.hasImage(b) ? 1 : 0) - (this.hasImage(a) ? 1 : 0) || (b.stock > 0 ? 1 : 0) - (a.stock > 0 ? 1 : 0));
  });

  visibleProducts = computed(() => this.sorted().slice(0, this.productLimit()));
  subtotal = computed(() => this.cart().reduce((s, l) => s + this.linePrice(l) * l.quantity, 0));
  cartCount = computed(() => this.cart().reduce((s, l) => s + l.quantity, 0));

  shippingCost = computed(() => {
    if (this.appliedCoupon()?.freeShipping) return 0;
    return this.subtotal() >= 500 ? 0 : 24.99;
  });

  discountTotal = computed(() => {
    const coupon = this.appliedCoupon();
    if (!coupon) return 0;
    if (coupon.discountPercent) {
      return (this.subtotal() * coupon.discountPercent) / 100;
    }
    if (coupon.discountAmount) {
      return Math.min(this.subtotal(), coupon.discountAmount);
    }
    return 0;
  });

  grandTotal = computed(() => {
    return Math.max(0, this.subtotal() - this.discountTotal() + this.shippingCost());
  });

  // Active Filter Chips
  activeFilterChips = computed<FilterChip[]>(() => {
    const chips: FilterChip[] = [];
    if (this.category) {
      chips.push({ id: 'cat', label: `Category: ${this.category}`, type: 'category' });
    }
    for (const c of this.selectedCategories()) {
      chips.push({ id: 'scat_' + c, label: c, type: 'selectedCategory', value: c });
    }
    if (this.selectedSubcategory()) {
      chips.push({ id: 'subcat', label: `Style: ${this.selectedSubcategory()}`, type: 'subcategory' });
    }
    if (this.minPrice() > 0 || this.maxPrice() < 2000) {
      chips.push({ id: 'price', label: `£${this.minPrice()} – £${this.maxPrice()}`, type: 'price' });
    }
    for (const col of this.selectedColours()) {
      chips.push({ id: 'col_' + col, label: `Finish: ${col}`, type: 'colour', value: col });
    }
    for (const b of this.selectedBrands()) {
      chips.push({ id: 'brand_' + b, label: `Brand: ${b}`, type: 'brand', value: b });
    }
    if (this.btuRange() !== 'all') {
      const labels: Record<string, string> = {
        under2k: '< 2,000 BTU',
        '2k-4k': '2,000 – 4,000 BTU',
        '4k-6k': '4,000 – 6,000 BTU',
        over6k: '6,000+ BTU'
      };
      chips.push({ id: 'btu', label: labels[this.btuRange()] || this.btuRange(), type: 'btu' });
    }
    if (this.inStockOnly()) {
      chips.push({ id: 'stock', label: 'In Stock (Next Day Dispatch)', type: 'inStock' });
    }
    for (const [group, val] of Object.entries(this.selectedCustomFilters())) {
      if (val) {
        chips.push({ id: 'cfg_' + group, label: `${group}: ${val}`, type: 'customFilter', value: group });
      }
    }
    return chips;
  });

  chosenVariant = computed(() => {
    const p = this.selected();
    if (!p?.variants?.length) return null;
    return p.variants.find(v =>
      (!this.chosenColour() || v.colour === this.chosenColour()) &&
      (!this.chosenHeight() || v.heightMm === this.chosenHeight()) &&
      (!this.chosenWidth() || v.widthMm === this.chosenWidth()) &&
      (!this.chosenPanel() || v.panel === this.chosenPanel())
    ) || p.variants.find(v =>
      (!this.chosenHeight() || v.heightMm === this.chosenHeight()) &&
      (!this.chosenWidth() || v.widthMm === this.chosenWidth())
    ) || p.variants.find(v =>
      (!this.chosenHeight() || v.heightMm === this.chosenHeight())
    ) || p.variants[0];
  });

  compatibleValves = computed(() => {
    return this.products().filter(p => p.category === 'Valves & Accessories' || p.category === 'Valves' || p.name.includes('Valve')).slice(0, 3);
  });

  private isPopState = false;

  updateBrowserHistory(targetView: string, productId?: number) {
    if (this.isPopState) {
      this.isPopState = false;
      return;
    }
    const currentParams = new URLSearchParams(window.location.search);
    const curView = currentParams.get('view') || 'shop';
    const curPid = currentParams.get('id');

    if (curView === targetView && (!productId || curPid === String(productId))) {
      return;
    }

    let url = '/';
    if (targetView !== 'shop') {
      url = `/?view=${encodeURIComponent(targetView)}`;
      if (productId) {
        url += `&id=${encodeURIComponent(productId)}`;
      }
    }
    window.history.pushState({ view: targetView, productId }, '', url);
  }

  goBack() {
    if (this.selected()) {
      this.selected.set(null);
      this.view.set('shop');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    if (this.isBrowsingCategory() || this.category || this.selectedSubcategory()) {
      this.category = '';
      this.selectedSubcategory.set('');
      this.selectedCategories.set([]);
      this.inStockOnly.set(false);
      this.view.set('shop');
      this.load();
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    if (this.view() !== 'shop') {
      this.view.set('shop');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    if (window.history.length > 1) {
      window.history.back();
    }
  }

  constructor() {
    try {
      localStorage.removeItem('thp_addresses');
    } catch (_) {}

    // Register popstate listener for browser back/forward buttons beside URL
    window.addEventListener('popstate', (event: PopStateEvent) => {
      this.isPopState = true;
      const state = event.state;
      let targetView = state?.view;
      let targetPid = state?.productId;
      if (!targetView) {
        const params = new URLSearchParams(window.location.search);
        targetView = params.get('view') || 'shop';
        targetPid = params.get('id') ? Number(params.get('id')) : undefined;
      }

      if (targetView === 'product' && targetPid) {
        const p = this.products().find(item => item.id === targetPid);
        if (p) {
          this.select(p, false);
          return;
        }
      }
      this.view.set(targetView as any);
    });

    // Handle initial page load with URL parameters
    const initParams = new URLSearchParams(window.location.search);
    const initCms = initParams.get('page') || initParams.get('cms');
    if (initCms) {
      setTimeout(() => this.openCmsPage(initCms), 100);
    }
    const initView = initParams.get('view');
    const initPid = initParams.get('id') ? Number(initParams.get('id')) : undefined;
    if (initView && initView !== 'shop') {
      this.view.set(initView as any);
      window.history.replaceState({ view: initView, productId: initPid }, '', window.location.href);
    } else {
      window.history.replaceState({ view: 'shop' }, '', '/');
    }

    effect(() => {
      const v = this.view();
      try {
        window.scrollTo({ top: 0, behavior: 'smooth' });
        document.documentElement.scrollTop = 0;
        document.body.scrollTop = 0;
      } catch (_) {}

      const pid = v === 'product' ? this.selected()?.id : undefined;
      this.updateBrowserHistory(v, pid);
    });

    this.resetDefaultSeo();
    this.load();
    this.http.get<Product[]>('/api/products').subscribe({
      next: prods => {
        if (prods && prods.length) {
          this.allCatalogProducts.set(prods);
        }
      },
      error: () => {}
    });
    this.loadReviews();
    this.loadBlogs();
    this.loadNavigation();

    const initBlogSlug = initParams.get('blog') || initParams.get('article');
    if (initBlogSlug) {
      this.view.set('blog');
      this.http.get<BlogPost>(`/api/blogs/${encodeURIComponent(initBlogSlug)}`).pipe(
        catchError(() => this.http.get<BlogPost[]>('/blogs.json').pipe(
          catchError(() => throwError(() => new Error('Not found')))
        ))
      ).subscribe({
        next: (res: any) => {
          if (Array.isArray(res)) {
            const found = res.find((b: any) => b.slug === initBlogSlug);
            if (found) this.selectedBlog.set(found);
          } else if (res && res.slug) {
            this.selectedBlog.set(res);
          }
        },
        error: () => {}
      });
    }

    if (this.sessionAuth) {
      this.savedAddresses.set(this.read<SavedAddress[]>(this.addressStorageKey, []));
      const headers = new HttpHeaders({ Authorization: 'Basic ' + this.sessionAuth });
      this.http.get<any>('/api/me', { headers }).subscribe({
        next: m => {
          this.isAdmin.set(!!m.admin);
          this.email = m.email || this.email;
          this.accountName.set(m.fullName || 'Customer');
          this.savedAddresses.set(this.read<SavedAddress[]>(this.addressStorageKey, []));
        },
        error: () => {}
      });
    } else {
      this.savedAddresses.set([]);
    }
    this.http.get<string[]>('/api/categories').subscribe({
      next: v => this.categories.set(v.filter(Boolean)),
      error: () => {}
    });
    this.calculateBtu();
    this.loadCmsBanner();
    this.loadStripeConfig();

    // Auto-advance banner slide every 6 seconds when viewing homepage
    setInterval(() => {
      if (this.heroBanners().length > 1 && !this.isBrowsingCategory() && this.view() === 'shop' && !this.query) {
        this.nextBanner();
      }
    }, 6000);

    // Register rate limiting listener from HTTP 429 interceptor
    window.addEventListener('thp-rate-limit', (event: any) => {
      const detail = event?.detail;
      const cooldownSecs = detail?.retryAfter || 60;
      this.rateLimitActive.set(true);
      this.rateLimitSeconds.set(cooldownSecs);
      this.rateLimitMessage.set(detail?.message || `Request limit reached. Please wait ${cooldownSecs} seconds.`);
      this.startRateLimitTimer();
    });
  }

  startRateLimitTimer() {
    if (this.rateLimitTimer) {
      clearInterval(this.rateLimitTimer);
    }
    this.rateLimitTimer = setInterval(() => {
      const current = this.rateLimitSeconds();
      if (current <= 1) {
        this.rateLimitActive.set(false);
        this.rateLimitSeconds.set(0);
        this.rateLimitMessage.set('');
        clearInterval(this.rateLimitTimer);
        this.rateLimitTimer = null;
      } else {
        this.rateLimitSeconds.set(current - 1);
      }
    }, 1000);
  }

  loadStripeConfig() {
    this.http.get<any>('/api/checkout/stripe/config').subscribe({
      next: (cfg) => {
        if (cfg?.publishableKey) {
          this.stripePublishableKey.set(cfg.publishableKey);
        }
        if (cfg?.mode) {
          this.stripeMode.set(cfg.mode);
        }
      },
      error: () => {}
    });
  }

  loadReviews() {
    const url = `/api/reviews?customerKey=${encodeURIComponent(this.customerKey)}`;
    this.http.get<ProductReview[]>(url).subscribe({
      next: (data) => {
        this.reviews.set(data || []);
      },
      error: () => {}
    });
  }

  homeCustomerReviews = computed(() => {
    return this.reviews().filter(r => r.status === 'APPROVED' || !r.status).slice(0, 6);
  });

  averageReviewRating = computed(() => {
    const revs = this.homeCustomerReviews();
    if (!revs.length) return '4.9';
    const sum = revs.reduce((acc, r) => acc + (r.rating || 5), 0);
    return (sum / revs.length).toFixed(1);
  });

  reviewInitials(name?: string): string {
    if (!name || !name.trim()) return 'TH';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return name.slice(0, 2).toUpperCase();
  }

  loadCmsBanner() {
    this.http.get<any[]>('/api/cms/banners').subscribe({
      next: (banners) => {
        if (banners && banners.length) {
          this.heroBanners.set(banners);
          if (this.currentBannerIndex() >= banners.length) {
            this.currentBannerIndex.set(0);
          }
        }
      },
      error: () => {}
    });
    this.http.get<any[]>('/api/cms/campaigns').subscribe({
      next: (campaigns) => {
        if (campaigns && campaigns.length) {
          this.campaignBanners.set(campaigns);
        }
      },
      error: () => {}
    });
    this.http.get<any>('/api/cms/announcement').subscribe({
      next: (ann) => {
        if (ann && ann.text) {
          this.announcementBanner.set(ann.text);
        }
      },
      error: () => {}
    });
    this.loadSocialLinks();
  }

  openCmsPage(slug: string) {
    this.http.get<any>('/api/cms/pages/' + slug).subscribe({
      next: (data) => {
        this.activeCmsModal.set(data);
      },
      error: () => {
        this.activeCmsModal.set({
          title: slug.replace(/-/g, ' ').toUpperCase(),
          body: 'Official customer documentation and policy information for THP Heating & Plumbing.'
        });
      }
    });
  }

  closeCmsModal() {
    this.activeCmsModal.set(null);
  }

  formatCmsHtml(body?: string): SafeHtml {
    if (!body) return '';
    const trimmed = body.trim();
    if (/<(?:p|h[1-6]|div|ul|ol|table|blockquote|section|article)\b/i.test(trimmed)) {
      return this.sanitizer.bypassSecurityTrustHtml(trimmed);
    }
    const lines = trimmed.split('\n');
    let html = '';
    let inList = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) {
        if (inList) { html += '</ul>'; inList = false; }
        continue;
      }
      if (line.startsWith('•') || line.startsWith('- ') || line.startsWith('* ')) {
        if (!inList) { html += '<ul class="cms-bullet-list mb-3">'; inList = true; }
        const itemContent = line.replace(/^[•\-*]\s*/, '');
        html += `<li>${this.escapeAndBold(itemContent)}</li>`;
        continue;
      }
      if (inList) { html += '</ul>'; inList = false; }
      if (/^(?:[0-9]+\.\s+|Q[0-9]+:|[A-Z\s&]{4,}:?$)/.test(line) && line.length < 90) {
        html += `<h3 class="h6 fw-bold mt-4 mb-2 text-dark border-bottom pb-1">${this.escapeAndBold(line)}</h3>`;
      } else {
        html += `<p class="mb-2 text-secondary" style="line-height:1.75">${this.escapeAndBold(line)}</p>`;
      }
    }
    if (inList) { html += '</ul>'; }
    return this.sanitizer.bypassSecurityTrustHtml(html);
  }

  private escapeAndBold(text: string): string {
    return text
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\b(sales@theheatingandplumbing\.com)\b/g, '<a href="mailto:$1" class="fw-semibold text-primary">$1</a>')
      .replace(/\b(\+44\s*7404095699)\b/g, '<a href="https://wa.me/447404095699" target="_blank" rel="noopener" class="fw-semibold text-success">$1</a>');
  }

  updateProductSeo(p: Product) {
    const title = `${p.name} | THP The Heating and Plumbing`;
    const desc = (p.description || `Buy ${p.name} online at THP. High heat output (${p.btu || 0} BTU / ${p.watts || 0}W), 10-year guarantee, and rapid UK delivery.`).slice(0, 160);
    const img = p.image || '/thp-logo.jpg';
    this.titleService.setTitle(title);
    this.metaService.updateTag({ name: 'description', content: desc });
    this.metaService.updateTag({ property: 'og:title', content: title });
    this.metaService.updateTag({ property: 'og:description', content: desc });
    this.metaService.updateTag({ property: 'og:image', content: img });
    this.metaService.updateTag({ name: 'twitter:title', content: title });
    this.metaService.updateTag({ name: 'twitter:description', content: desc });
    this.metaService.updateTag({ name: 'twitter:image', content: img });
  }

  resetDefaultSeo() {
    const title = 'THP — The Heating and Plumbing | Designer Radiators, Towel Rails & Modern Heating';
    const desc = 'The Heating and Plumbing (THP) — UK specialist in high-performance designer radiators, heated towel rails, electric heating and precision TRV valves. Backed by 10-year guarantees and expert BTU sizing.';
    this.titleService.setTitle(title);
    this.metaService.updateTag({ name: 'description', content: desc });
    this.metaService.updateTag({ property: 'og:title', content: title });
    this.metaService.updateTag({ property: 'og:description', content: desc });
    this.metaService.updateTag({ property: 'og:image', content: '/thp-logo.jpg' });
    this.metaService.updateTag({ name: 'twitter:title', content: title });
    this.metaService.updateTag({ name: 'twitter:description', content: desc });
    this.metaService.updateTag({ name: 'twitter:image', content: '/thp-logo.jpg' });
  }

  @HostListener('document:keydown.escape')
  onEscape() {
    this.activeNavHover.set(null);
    this.mobileNavOpen.set(false);
    this.showMobileFilters.set(false);
    this.closeLightbox();
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    if (!this.activeNavHover()) return;
    const target = event.target as HTMLElement;
    if (!target.closest('.primary-nav-bar')) {
      this.closeNavHover();
    }
  }

  @HostListener('document:keydown.arrowleft')
  onArrowLeft() {
    if (this.zoomImage() && this.selected()) {
      this.prevGalleryImage(this.selected()!);
    }
  }

  @HostListener('document:keydown.arrowright')
  onArrowRight() {
    if (this.zoomImage() && this.selected()) {
      this.nextGalleryImage(this.selected()!);
    }
  }

  onHeroMouseMove(e: MouseEvent) {
    const target = e.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    const x = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
    const y = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100));
    this.hoverZoomX.set(Math.round(x));
    this.hoverZoomY.set(Math.round(y));
    this.isHoverZoom.set(true);
  }

  onHeroMouseLeave() {
    this.isHoverZoom.set(false);
  }

  openLightbox(img?: string) {
    const targetImg = img || this.activeImage() || this.selected()?.image || '';
    this.zoomImage.set(targetImg);
    this.lightboxZoom.set(1);
    this.lightboxPanX.set(0);
    this.lightboxPanY.set(0);
    this.isPanning.set(false);
    this.lightboxHovered.set(false);
    this.startLightboxAutoPlay();
  }

  closeLightbox() {
    this.stopLightboxAutoPlay();
    this.zoomImage.set('');
    this.lightboxZoom.set(1);
    this.lightboxPanX.set(0);
    this.lightboxPanY.set(0);
    this.isPanning.set(false);
    this.lightboxHovered.set(false);
  }

  startLightboxAutoPlay() {
    this.stopLightboxAutoPlay();
    const sel = this.selected();
    if (!sel || this.galleryImages(sel).length <= 1) return;
    this.lightboxAutoPlay.set(true);
    this.lightboxProgress.set(0);

    const stepMs = 50;
    const totalMs = 3500;
    let elapsed = 0;

    this.lightboxProgressTimer = setInterval(() => {
      // Pause advancing if zoomed in, dragging/panning, or hovering canvas to inspect
      if (this.lightboxZoom() > 1 || this.isPanning() || this.lightboxHovered()) {
        return;
      }
      elapsed += stepMs;
      const pct = Math.min(100, Math.round((elapsed / totalMs) * 100));
      this.lightboxProgress.set(pct);

      if (elapsed >= totalMs) {
        elapsed = 0;
        this.lightboxProgress.set(0);
        const currentSel = this.selected();
        if (currentSel) {
          this.nextGalleryImage(currentSel, false);
        }
      }
    }, stepMs);
  }

  stopLightboxAutoPlay() {
    if (this.lightboxProgressTimer) {
      clearInterval(this.lightboxProgressTimer);
      this.lightboxProgressTimer = null;
    }
    this.lightboxProgress.set(0);
  }

  toggleLightboxAutoPlay() {
    if (this.lightboxAutoPlay()) {
      this.lightboxAutoPlay.set(false);
      this.stopLightboxAutoPlay();
    } else {
      this.startLightboxAutoPlay();
    }
  }

  onLightboxCanvasEnter() {
    this.lightboxHovered.set(true);
  }

  onLightboxCanvasLeave() {
    this.lightboxHovered.set(false);
  }

  selectLightboxImage(img: string) {
    this.zoomImage.set(img);
    this.activeImage.set(img);
    this.resetLightboxZoom();
    if (this.lightboxAutoPlay()) {
      this.startLightboxAutoPlay();
    }
  }

  zoomIn(step = 0.3) {
    this.lightboxZoom.update(z => Math.min(3.5, Math.round((z + step) * 10) / 10));
  }

  zoomOut(step = 0.3) {
    this.lightboxZoom.update(z => {
      const next = Math.max(1, Math.round((z - step) * 10) / 10);
      if (next === 1) {
        this.lightboxPanX.set(0);
        this.lightboxPanY.set(0);
      }
      return next;
    });
  }

  resetLightboxZoom() {
    this.lightboxZoom.set(1);
    this.lightboxPanX.set(0);
    this.lightboxPanY.set(0);
    this.isPanning.set(false);
  }

  toggleLightboxZoom() {
    if (this.lightboxZoom() > 1.2) {
      this.resetLightboxZoom();
    } else {
      this.lightboxZoom.set(2.2);
    }
  }

  onModalWheel(e: WheelEvent) {
    e.preventDefault();
    if (e.deltaY < 0) {
      this.zoomIn(0.2);
    } else {
      this.zoomOut(0.2);
    }
  }

  startPan(e: MouseEvent) {
    if (this.lightboxZoom() <= 1) return;
    e.preventDefault();
    this.isPanning.set(true);
    this.panStartX = e.clientX - this.lightboxPanX();
    this.panStartY = e.clientY - this.lightboxPanY();
  }

  doPan(e: MouseEvent) {
    if (!this.isPanning() || this.lightboxZoom() <= 1) return;
    e.preventDefault();
    const maxPan = 400 * (this.lightboxZoom() - 1);
    const newX = Math.max(-maxPan, Math.min(maxPan, e.clientX - this.panStartX));
    const newY = Math.max(-maxPan, Math.min(maxPan, e.clientY - this.panStartY));
    this.lightboxPanX.set(newX);
    this.lightboxPanY.set(newY);
  }

  endPan() {
    this.isPanning.set(false);
  }

  prevGalleryImage(p: Product, restartTimer = true) {
    const list = this.galleryImages(p);
    if (!list.length) return;
    const current = this.zoomImage() || this.activeImage();
    const idx = list.indexOf(current);
    const nextIdx = idx <= 0 ? list.length - 1 : idx - 1;
    this.zoomImage.set(list[nextIdx]);
    this.activeImage.set(list[nextIdx]);
    this.resetLightboxZoom();
    if (restartTimer && this.lightboxAutoPlay()) {
      this.startLightboxAutoPlay();
    }
  }

  nextGalleryImage(p: Product, restartTimer = true) {
    const list = this.galleryImages(p);
    if (!list.length) return;
    const current = this.zoomImage() || this.activeImage();
    const idx = list.indexOf(current);
    const nextIdx = idx >= list.length - 1 ? 0 : idx + 1;
    this.zoomImage.set(list[nextIdx]);
    this.activeImage.set(list[nextIdx]);
    this.resetLightboxZoom();
    if (restartTimer && this.lightboxAutoPlay()) {
      this.startLightboxAutoPlay();
    }
  }

  read<T>(key: string, fallback: T): T {
    try {
      return JSON.parse(localStorage.getItem(key) || '') as T;
    } catch {
      return fallback;
    }
  }

  save(key: string, value: unknown) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  showToast(msg: string, action: string | null = null) {
    const cleanMsg = msg ? msg.replace(/^[✓✔]\s*/, '').trim() : '';
    this.toastMessage.set(cleanMsg);
    this.toastAction.set(action);
    setTimeout(() => {
      this.toastMessage.set('');
      this.toastAction.set(null);
    }, 4000);
  }

  load() {
    if (this.rateLimitActive()) {
      this.showToast(`Rate limit active. Please wait ${this.rateLimitSeconds()}s before requesting catalog.`);
      return;
    }
    this.loading.set(true);
    this.productLimit.set(24);
    this.http.get<Product[]>('/api/products', {
      params: { q: this.query, category: this.category }
    }).subscribe({
      next: v => {
        this.products.set(v || []);
        this.loading.set(false);
        const params = new URLSearchParams(window.location.search);
        const reqView = params.get('view');
        const reqId = params.get('id');
        if (reqView === 'product' && reqId && !this.selected()) {
          const p = (v || []).find(item => item.id === Number(reqId));
          if (p) {
            this.select(p, false);
          }
        }
      },
      error: () => this.loading.set(false)
    });
  }

  submitSearch() {
    if (this.rateLimitActive()) {
      this.showToast(`Rate limit active. Please wait ${this.rateLimitSeconds()}s before searching.`);
      return;
    }
    this.category = '';
    this.selectedSubcategory.set('');
    this.selectedCategories.set([]);
    this.selectedColours.set([]);
    this.selectedBrands.set([]);
    this.btuRange.set('all');
    this.inStockOnly.set(false);
    this.activeNavHover.set(null);
    this.mobileNavOpen.set(false);
    this.view.set('shop');
    this.resetDefaultSeo();
    this.load();
    this.scrollProducts();
  }

  clearSearch() {
    this.query = '';
    this.submitSearch();
  }

  // Navigation & Child Sub-menu Actions
  private navCloseTimer: any = null;

  openNavHover(menuId: string) {
    this.keepNavMenuOpen();
    this.activeNavHover.set(menuId);
  }

  closeNavHover() {
    this.closeNavMenu(this.activeNavHover() || '');
  }

  toggleNavMenu(menuId: string, event?: Event) {
    if (event) {
      event.stopPropagation();
    }
    if (this.activeNavHover() === menuId) {
      this.activeNavHover.set(null);
    } else {
      this.keepNavMenuOpen();
      this.activeNavHover.set(menuId);
    }
  }

  openNavMenu(menuId: string) {
    this.keepNavMenuOpen();
    this.activeNavHover.set(menuId);
  }

  closeNavMenu(menuId: string) {
    if (this.navCloseTimer) {
      clearTimeout(this.navCloseTimer);
    }
    this.navCloseTimer = setTimeout(() => {
      if (this.activeNavHover() === menuId) {
        this.activeNavHover.set(null);
      }
    }, 350);
  }

  keepNavMenuOpen() {
    if (this.navCloseTimer) {
      clearTimeout(this.navCloseTimer);
      this.navCloseTimer = null;
    }
  }

  onMenuHeaderClick(menu: NavParentMenu, event?: Event) {
    if (event) {
      event.stopPropagation();
    }
    this.keepNavMenuOpen();
    if (this.activeNavHover() === menu.id) {
      this.activeNavHover.set(null);
    } else {
      this.activeNavHover.set(menu.id);
    }
  }

  categoryCount(catName: string): number {
    const list = this.allCatalogProducts().length > 0 ? this.allCatalogProducts() : this.products();
    if (!catName || catName.toLowerCase() === 'sale') return list.length;
    return list.filter(p => this.categoryMatches(p.category, catName)).length;
  }

  toggleMobileCategory(menuId: string) {
    this.expandedMobileMenu.update(current => current === menuId ? null : menuId);
  }

  chooseParentCategory(categoryName: string) {
    this.category = categoryName;
    this.selectedSubcategory.set('');
    this.selectedCategories.set([]);
    this.selectedColours.set([]);
    this.selectedBrands.set([]);
    this.minPrice.set(0);
    this.maxPrice.set(9999);
    this.btuRange.set('all');
    this.inStockOnly.set(false);
    this.activeNavHover.set(null);
    this.mobileNavOpen.set(false);
    this.selected.set(null);
    this.view.set('shop');
    this.load();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  selectChildItem(item: NavChildItem, parentCategory?: string) {
    if (parentCategory) {
      this.category = parentCategory;
    }
    if (item.category) {
      this.category = item.category;
    }
    if (item.query) {
      this.selectedSubcategory.set(item.query);
    } else {
      this.selectedSubcategory.set('');
    }
    if (item.colour) {
      this.selectedColours.set([item.colour]);
    } else {
      this.selectedColours.set([]);
    }
    this.selectedCategories.set([]);
    this.selectedBrands.set([]);
    this.minPrice.set(0);
    this.maxPrice.set(9999);
    this.btuRange.set('all');
    this.inStockOnly.set(false);
    this.activeNavHover.set(null);
    this.mobileNavOpen.set(false);
    this.selected.set(null);
    this.view.set('shop');
    this.load();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  selectPromoCard(promo: any, parentCategory?: string) {
    if (!promo) return;
    if (promo.category) {
      this.category = promo.category;
    } else if (parentCategory) {
      this.category = parentCategory;
    }
    if (promo.query) {
      this.selectedSubcategory.set(promo.query);
    } else {
      this.selectedSubcategory.set('');
    }
    this.selectedCustomFilters.set({});
    this.selectedCategories.set([]);
    this.selectedColours.set([]);
    this.selectedBrands.set([]);
    this.minPrice.set(0);
    this.maxPrice.set(9999);
    this.btuRange.set('all');
    this.inStockOnly.set(false);
    this.activeNavHover.set(null);
    this.mobileNavOpen.set(false);
    this.selected.set(null);
    this.view.set('shop');
    this.load();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  goHome() {
    this.category = '';
    this.query = '';
    this.selectedSubcategory.set('');
    this.selectedCategories.set([]);
    this.selectedColours.set([]);
    this.selectedBrands.set([]);
    this.selectedPriceRange.set('all');
    this.minPrice.set(0);
    this.maxPrice.set(9999);
    this.btuRange.set('all');
    this.inStockOnly.set(false);
    this.activeNavHover.set(null);
    this.mobileNavOpen.set(false);
    this.selected.set(null);
    this.view.set('shop');
    this.productLimit.set(24);
    this.loadCmsBanner();
    this.resetDefaultSeo();
    this.load();
    try {
      window.history.replaceState({ view: 'shop' }, '', '/');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (_) {}
  }

  showAllProducts() {
    this.goHome();
  }

  showInStock() {
    this.inStockOnly.set(true);
    this.activeNavHover.set(null);
    this.mobileNavOpen.set(false);
    this.view.set('shop');
    this.load();
    this.scrollProducts();
  }

  // Facet Accordion Toggle
  toggleAccordion(section: keyof AccordionState) {
    this.accordionState.update(s => ({ ...s, [section]: !s[section] }));
  }

  // Facet Checkbox Toggles
  toggleCategoryFacet(catName: string) {
    this.selectedCategories.update(list => {
      return list.includes(catName) ? list.filter(c => c !== catName) : [...list, catName];
    });
  }

  toggleColourFacet(colourName: string) {
    this.selectedColours.update(list => {
      return list.includes(colourName) ? list.filter(c => c !== colourName) : [...list, colourName];
    });
  }

  toggleBrandFacet(brandName: string) {
    this.selectedBrands.update(list => {
      return list.includes(brandName) ? list.filter(b => b !== brandName) : [...list, brandName];
    });
  }

  toggleColour(colourName: string) {
    this.toggleColourFacet(colourName);
  }

  toggleBrand(brandName: string) {
    this.toggleBrandFacet(brandName);
  }

  toggleInStock() {
    this.inStockOnly.update(v => !v);
  }

  setPriceBracket(min: number, max: number) {
    this.minPrice.set(min);
    this.maxPrice.set(max);
  }

  setBtuBracket(bracket: 'all' | 'under2k' | '2k-4k' | '4k-6k' | 'over6k') {
    this.btuRange.set(bracket);
  }

  removeChip(chip: FilterChip) {
    if (chip.type === 'category') this.category = '';
    if (chip.type === 'selectedCategory') this.selectedCategories.update(v => v.filter(x => x !== chip.value));
    if (chip.type === 'subcategory') this.selectedSubcategory.set('');
    if (chip.type === 'customFilter' && chip.value) {
      const cur = { ...this.selectedCustomFilters() };
      delete cur[chip.value];
      this.selectedCustomFilters.set(cur);
    }
    if (chip.type === 'price') { this.minPrice.set(0); this.maxPrice.set(2000); }
    if (chip.type === 'colour') this.selectedColours.update(v => v.filter(x => x !== chip.value));
    if (chip.type === 'brand') this.selectedBrands.update(v => v.filter(x => x !== chip.value));
    if (chip.type === 'btu') this.btuRange.set('all');
    if (chip.type === 'inStock') this.inStockOnly.set(false);
  }

  toggleCustomFilter(groupName: string, option: string) {
    if (!groupName || !option) return;
    const cur = { ...this.selectedCustomFilters() };
    if (cur[groupName] === option) {
      delete cur[groupName];
    } else {
      cur[groupName] = option;
    }
    this.selectedCustomFilters.set(cur);
  }

  clearFilters() {
    this.category = '';
    this.query = '';
    this.selectedCategories.set([]);
    this.selectedSubcategory.set('');
    this.selectedCustomFilters.set({});
    this.selectedPriceRange.set('all');
    this.minPrice.set(0);
    this.maxPrice.set(9999);
    this.selectedColours.set([]);
    this.selectedBrands.set([]);
    this.btuRange.set('all');
    this.inStockOnly.set(false);
    this.load();
  }

  scrollProducts() {
    setTimeout(() => {
      document.getElementById('products')?.scrollIntoView({ behavior: 'smooth' });
    }, 50);
  }

  scrollToBtu() {
    this.activeNavHover.set(null);
    this.mobileNavOpen.set(false);
    this.view.set('shop');
    setTimeout(() => {
      document.getElementById('btu-calculator')?.scrollIntoView({ behavior: 'smooth' });
    }, 50);
  }

  // BTU Calculator Logic
  calculateBtu() {
    const area = Number(this.btuArea) || 15;
    let typeFactor = 95;
    if (this.btuRoomType === 'bathroom') typeFactor = 110;
    else if (this.btuRoomType === 'living') typeFactor = 100;
    else if (this.btuRoomType === 'kitchen') typeFactor = 85;
    else if (this.btuRoomType === 'bedroom') typeFactor = 90;

    let insulationFactor = 1.0;
    if (this.btuInsulation === 'high') insulationFactor = 0.85;
    else if (this.btuInsulation === 'period') insulationFactor = 1.35;
    const tempFactor = Number(this.btuTemp) === 23 ? 1.15 : (Number(this.btuTemp) === 18 ? 0.88 : 1.0);
    const watts = Math.round(area * typeFactor * insulationFactor * tempFactor);
    const btu = Math.round(watts * 3.412);
    this.estimatedWatts.set(watts);
    this.estimatedBtu.set(btu);
  }

  filterByBtu() {
    this.category = 'Radiators';
    if (this.estimatedBtu() < 2500) this.btuRange.set('under2k');
    else if (this.estimatedBtu() <= 4000) this.btuRange.set('2k-4k');
    else if (this.estimatedBtu() <= 6000) this.btuRange.set('4k-6k');
    else this.btuRange.set('over6k');
    this.view.set('shop');
    this.load();
    this.scrollProducts();
    this.showToast(`Showing radiators ideal for ~${this.estimatedWatts()}W (${this.estimatedBtu()} BTU)`);
  }

  // Product Selection & PDP
  select(p: Product, push = true) {
    this.selected.set(p);
    const v = p.variants?.[0];
    const availColours = this.colours(p);
    this.chosenColour.set(v?.colour || p.colour || availColours[0] || 'Traffic White (RAL 9016)');
    this.chosenHeight.set(v?.heightMm || this.extractHeightFromName(p) || 600);
    this.chosenWidth.set(v?.widthMm);
    this.chosenPanel.set(v?.panel || '');
    const imgs = this.galleryImages(p);
    this.activeImage.set(imgs[0] || v?.image || p.image || '');
    this.productQty.set(1);
    this.activePdpTab.set('overview');
    this.activeNavHover.set(null);
    if (!push) {
      this.isPopState = true;
    }
    this.view.set('product');
    this.updateProductSeo(p);
    scrollTo({ top: 0, behavior: 'smooth' });
  }

  dimensionsImage(p: Product): string {
    const name = (p.name || '').toUpperCase();
    const type = (p.type || '').toUpperCase();
    const sku = (p.sku || '').toUpperCase();
    const cat = (p.category || '').toUpperCase();

    if (name.includes('COMPACT 6') || sku.includes('C6-')) {
      if (name.includes('DS') || sku.includes('DS')) return '/api/product-images/dimensions-compact-6-ds.svg';
      if (name.includes('TS') || sku.includes('TS')) return '/api/product-images/dimensions-compact-6-ts.svg';
      if (name.includes('QS') || sku.includes('QS')) return '/api/product-images/dimensions-compact-6-qs.svg';
      return '/api/product-images/dimensions-compact-6-ds.svg';
    }
    if (name.includes('HF') || type.includes('TYPE 21') || name.includes('TYPE 21')) {
      return '/api/product-images/dimensions-compact-4-hf.svg';
    }
    if (name.includes('DF') || type.includes('TYPE 22') || name.includes('TYPE 22')) {
      return '/api/product-images/dimensions-compact-4-df.svg';
    }
    if (name.includes('SF') || type.includes('TYPE 11') || name.includes('TYPE 11')) {
      return '/api/product-images/dimensions-compact-4-sf.svg';
    }
    if ((name.includes('PLANAL') || name.includes('LANNER')) && name.includes('VERTICAL')) {
      return '/api/product-images/dimensions-vertical.svg';
    }
    if (name.includes('BANIO') || name.includes('BUCKINGHAM') || name.includes('CHELMSFORD') || cat.includes('TOWEL')) {
      return '/api/product-images/dimensions-towel-warmer.svg';
    }
    if (name.includes('VALVE') || name.includes('TRV') || cat.includes('VALVE')) {
      return '/api/product-images/dimensions-radiator-valves.svg';
    }
    return '/api/product-images/dimensions-default.svg';
  }

  viewDimensionsImage(p: Product) {
    const dim = this.dimensionsImage(p);
    if (dim) {
      this.activeImage.set(dim);
    }
  }

  galleryImages(p: Product): string[] {
    const name = (p.name || '').toUpperCase();
    const type = (p.type || '').toUpperCase();
    const list: string[] = [];
    const dimImg = this.dimensionsImage(p);

    // Compact 4 HF (Double-Single / Type 21)
    if (name.includes('HF') || type.includes('TYPE 21') || name.includes('TYPE 21')) {
      list.push(
        '/api/product-images/6808f569-2ebf-46ee-b3dc-9ce1fae26572.jpg', // Room lifestyle installation
        '/api/product-images/00def179-3802-49f4-9f57-a1a6a74e60ae.jpg', // Front studio render
        dimImg,                                                           // Technical CAD Blueprint & Dimensions
        '/api/product-images/c6610283-530b-4320-a359-1c3f68ec5a9b.jpg', // Top grille & internal fin detail
        '/api/product-images/edd80447-8be7-4cd4-b00b-af52557960ee.jpg'  // Side profile & 4x 1/2" tappings
      );
    }
    // Compact 4 DF (Double Convector / Type 22)
    else if (name.includes('DF') || type.includes('TYPE 22') || name.includes('TYPE 22')) {
      list.push(
        '/api/product-images/0713728c-0370-4e96-83ec-c5a0437b55f3.jpg', // Room lifestyle installation
        '/api/product-images/25cfc707-546a-4ffb-b04a-e4ac60363f2f.jpg', // Front studio render
        dimImg,                                                           // Technical CAD Blueprint & Dimensions
        '/api/product-images/7272ca03-27f7-4a55-8909-6d76031bd5d5.jpg', // 3D Isometric corner
        '/api/product-images/c6610283-530b-4320-a359-1c3f68ec5a9b.jpg', // Top grille & internal fin detail
        '/api/product-images/edd80447-8be7-4cd4-b00b-af52557960ee.jpg'  // Side profile & tappings
      );
    }
    // Compact 4 SF (Single Convector / Type 11)
    else if (name.includes('SF') || type.includes('TYPE 11') || name.includes('TYPE 11')) {
      list.push(
        '/api/product-images/712218f0-c329-4d87-afa3-147ea2f8571c.jpg', // Room lifestyle installation
        '/api/product-images/3b09bd8d-c296-4f80-83dd-36add216b19f.jpg', // Front studio render
        dimImg,                                                           // Technical CAD Blueprint & Dimensions
        '/api/product-images/be9acb92-e73a-40a4-b4db-d06a158ec157.png', // Convector fin construction detail
        '/api/product-images/c6610283-530b-4320-a359-1c3f68ec5a9b.jpg'  // Top grille detail
      );
    }
    // Compact 6 Multi-Port (DS / TS / QS)
    else if (name.includes('COMPACT 6') || (p.sku && p.sku.includes('C6-'))) {
      if (name.includes('DS') || (p.sku && p.sku.includes('DS'))) {
        list.push(
          '/api/product-images/c6000001-0000-4000-a000-000000000001.jpg', // Compact 6 2DS lifestyle render
          '/api/product-images/0713728c-0370-4e96-83ec-c5a0437b55f3.jpg', // Room installation
          dimImg,                                                           // Technical CAD Blueprint & Dimensions
          '/api/product-images/25cfc707-546a-4ffb-b04a-e4ac60363f2f.jpg', // Front studio render
          '/api/product-images/c6610283-530b-4320-a359-1c3f68ec5a9b.jpg', // Top grille & internal fin detail
          '/api/product-images/edd80447-8be7-4cd4-b00b-af52557960ee.jpg'  // Side profile & 6 tappings
        );
      } else if (name.includes('TS') || (p.sku && p.sku.includes('TS'))) {
        list.push(
          '/api/product-images/c6000002-0000-4000-a000-000000000002.jpg', // Compact 6 9TS lifestyle render
          '/api/product-images/0713728c-0370-4e96-83ec-c5a0437b55f3.jpg',
          dimImg,                                                           // Technical CAD Blueprint & Dimensions
          '/api/product-images/25cfc707-546a-4ffb-b04a-e4ac60363f2f.jpg',
          '/api/product-images/c6610283-530b-4320-a359-1c3f68ec5a9b.jpg',
          '/api/product-images/edd80447-8be7-4cd4-b00b-af52557960ee.jpg'
        );
      } else if (name.includes('QS') || (p.sku && p.sku.includes('QS'))) {
        list.push(
          '/api/product-images/c6000003-0000-4000-a000-000000000003.jpg', // Compact 6 3QS lifestyle render
          '/api/product-images/0713728c-0370-4e96-83ec-c5a0437b55f3.jpg',
          dimImg,                                                           // Technical CAD Blueprint & Dimensions
          '/api/product-images/25cfc707-546a-4ffb-b04a-e4ac60363f2f.jpg',
          '/api/product-images/c6610283-530b-4320-a359-1c3f68ec5a9b.jpg',
          '/api/product-images/edd80447-8be7-4cd4-b00b-af52557960ee.jpg'
        );
      } else {
        list.push(
          '/api/product-images/c6000001-0000-4000-a000-000000000001.jpg',
          '/api/product-images/0713728c-0370-4e96-83ec-c5a0437b55f3.jpg',
          dimImg,
          '/api/product-images/25cfc707-546a-4ffb-b04a-e4ac60363f2f.jpg',
          '/api/product-images/c6610283-530b-4320-a359-1c3f68ec5a9b.jpg',
          '/api/product-images/edd80447-8be7-4cd4-b00b-af52557960ee.jpg'
        );
      }
    }
    // Planal Horizontal
    else if (name.includes('PLANAL') && !name.includes('VERTICAL')) {
      list.push(
        '/api/product-images/fc274807-bc10-4063-b29c-c8bde1f7dd00.png',
        dimImg,
        '/api/product-images/c6610283-530b-4320-a359-1c3f68ec5a9b.jpg',
        '/api/product-images/edd80447-8be7-4cd4-b00b-af52557960ee.jpg'
      );
    }
    // Planal / Lanner Vertical
    else if ((name.includes('PLANAL') || name.includes('LANNER')) && name.includes('VERTICAL')) {
      list.push(
        '/api/product-images/1c3078f3-9906-422a-913b-08b8a6044664.png',
        dimImg,
        '/api/product-images/eb94c3c0-a10d-4df7-b20a-5b9eccf94612.png',
        '/api/product-images/706d27f0-4c0d-4d39-8f3f-2afd0403caea.png'
      );
    }
    // Lanner Horizontal
    else if (name.includes('LANNER')) {
      list.push(
        '/api/product-images/d828b155-c328-425e-b509-6f4492e6d09e.png',
        dimImg,
        '/api/product-images/706d27f0-4c0d-4d39-8f3f-2afd0403caea.png'
      );
    }
    // LSOrad Low Surface Temperature
    else if (name.includes('LSO') || name.includes('LOW SURFACE')) {
      list.push(
        '/api/product-images/56dd11ba-f583-4cc8-8918-66dc45078c3b.png',
        dimImg,
        '/api/product-images/c6610283-530b-4320-a359-1c3f68ec5a9b.jpg'
      );
    }
    // Banio Heated Towel Warmer
    else if (name.includes('BANIO')) {
      list.push(
        '/api/product-images/325c65f7-c7eb-4da9-b4e1-8a150483c9e5.jpg',
        dimImg,
        '/api/product-images/00b4dabb-b31d-4624-a139-5ac57bdab052.jpg'
      );
    }
    // Buckingham Towel Warmer
    else if (name.includes('BUCKINGHAM')) {
      list.push(
        '/api/product-images/54f742c6-4f7b-4fb3-8cbf-891147ac4b5e.jpg',
        dimImg,
        '/api/product-images/325c65f7-c7eb-4da9-b4e1-8a150483c9e5.jpg'
      );
    }
    // Chelmsford Towel Warmer
    else if (name.includes('CHELMSFORD')) {
      list.push(
        '/api/product-images/dbc885fc-2ddf-4f6b-b491-6f7409280e42.jpg',
        dimImg,
        '/api/product-images/00b4dabb-b31d-4624-a139-5ac57bdab052.jpg'
      );
    }
    // TRV & Radiator Valves
    else if (name.includes('VALVE') || name.includes('TRV')) {
      list.push(
        p.image || '/api/product-images/65301fc2-1bf1-4cff-b046-589de5422312.jpg',
        dimImg,
        '/api/product-images/9a1b3935-298b-444b-8fb6-f1396be8f85c.png',
        '/api/product-images/9d6cd9d2-2752-4f8b-b189-086cf5cb03d4.jpg'
      );
    }

    // Always ensure the dimensions schematic image is in the list
    if (dimImg && !list.includes(dimImg)) {
      list.push(dimImg);
    }

    // Always ensure the product default image is available
    if (p.image && !list.includes(p.image)) {
      list.unshift(p.image);
    }

    // Include any variant images if provided
    (p.variants || []).forEach(v => {
      if (v.image && !list.includes(v.image)) {
        list.push(v.image);
      }
    });

    return list.filter(Boolean);
  }

  colours(p: Product): string[] {
    const fromVariants = Array.from(new Set([p.colour, ...(p.variants || []).map(v => v.colour)].filter(Boolean)));
    if (fromVariants.length > 1) {
      return fromVariants;
    }

    const cat = (p.category || '').toLowerCase();
    const name = (p.name || '').toLowerCase();

    if (cat.includes('towel') || name.includes('towel') || name.includes('banio')) {
      return ['Traffic White (RAL 9016)', 'Anthracite Grey (RAL 7016)', 'Polished Chrome', 'Matt Black (RAL 9005)'];
    }
    if (cat.includes('valve') || name.includes('valve') || name.includes('trv')) {
      return ['Polished Chrome', 'Matt Black (RAL 9005)', 'Anthracite Grey (RAL 7016)', 'Brushed Brass'];
    }
    return ['Traffic White (RAL 9016)', 'Anthracite Grey (RAL 7016)', 'Matt Black (RAL 9005)'];
  }

  extractHeightFromName(p: Product): number | null {
    const m = (p.name || '').match(/(\d{3,4})\s*mm/i);
    return m ? parseInt(m[1], 10) : null;
  }

  productFamilyKey(p: Product): string {
    const n = (p.name || '').toLowerCase();
    const sku = (p.sku || '').toLowerCase();
    if (n.includes('compact 4') && (n.includes('df') || n.includes('type 22') || n.includes('double convector'))) return 'compact-4-df';
    if (n.includes('compact 4') && (n.includes('sf') || n.includes('type 11') || n.includes('single convector'))) return 'compact-4-sf';
    if (n.includes('compact 4') && (n.includes('hf') || n.includes('type 21') || n.includes('double-single'))) return 'compact-4-hf';
    if ((n.includes('compact 6') || sku.includes('c6-')) && (n.includes('ds') || sku.includes('ds'))) return 'compact-6-ds';
    if ((n.includes('compact 6') || sku.includes('c6-')) && (n.includes('ts') || sku.includes('ts'))) return 'compact-6-ts';
    if ((n.includes('compact 6') || sku.includes('c6-')) && (n.includes('qs') || sku.includes('qs'))) return 'compact-6-qs';
    if (n.includes('compact 6') && (n.includes('vertical') || n.includes('vss'))) return 'compact-6-vertical';
    if (n.includes('compact 6')) return 'compact-6';
    if (n.includes('compact') && n.includes('vertical')) return 'compact-vertical';
    if (n.includes('planal') && (n.includes('vps') || n.includes('vpd') || n.includes('vertical'))) return 'planal-vertical';
    if (n.includes('planal')) return 'planal-horizontal';
    if (n.includes('lanner') && (n.includes('vlh') || n.includes('vld') || n.includes('vertical'))) return 'lanner-vertical';
    if (n.includes('lanner')) return 'lanner-horizontal';
    if (n.includes('lsorad')) return 'lsorad';
    return n.replace(/\b\d{3,4}\s*mm\b/gi, '').trim();
  }

  siblingProducts(p: Product): Product[] {
    const key = this.productFamilyKey(p);
    if (!key) return [];
    const pool = this.allCatalogProducts().length > 0 ? this.allCatalogProducts() : this.products();
    return pool.filter(x => this.productFamilyKey(x) === key);
  }

  heights(p: Product): number[] {
    const set = new Set<number>();
    (p.variants || []).forEach(v => {
      if (v.heightMm != null && v.heightMm > 0) set.add(v.heightMm);
    });

    const siblings = this.siblingProducts(p);
    siblings.forEach(sp => {
      (sp.variants || []).forEach(v => {
        if (v.heightMm != null && v.heightMm > 0) set.add(v.heightMm);
      });
      const m = this.extractHeightFromName(sp);
      if (m) set.add(m);
    });

    if (set.size === 0) {
      const selfHeight = this.extractHeightFromName(p);
      if (selfHeight) set.add(selfHeight);
      else set.add(600);
    }

    return Array.from(set).sort((a, b) => a - b);
  }

  cardHeightText(p: Product): string {
    const h = this.heights(p);
    if (!h || h.length === 0) return 'Standard Height';
    if (h.length === 1) return `Height: ${h[0]}mm`;
    return `${h.length} Heights (${h[0]}–${h[h.length - 1]}mm)`;
  }

  widths(p: Product): number[] {
    const list = (p.variants || [])
      .filter(v => !this.chosenHeight() || v.heightMm === this.chosenHeight())
      .map(v => v.widthMm)
      .filter((v): v is number => v != null);
    if (list.length === 0) {
      return Array.from(new Set((p.variants || []).map(v => v.widthMm).filter((v): v is number => v != null))).sort((a, b) => a - b);
    }
    return Array.from(new Set(list)).sort((a, b) => a - b);
  }

  panels(p: Product): string[] {
    return Array.from(new Set((p.variants || []).map(v => v.panel).filter(Boolean)));
  }

  chooseColour(p: Product, value: string) {
    this.chosenColour.set(value);
    const v = p.variants.find(x => x.colour === value);
    if (v) {
      if (v.heightMm) this.chosenHeight.set(v.heightMm);
      if (v.widthMm) this.chosenWidth.set(v.widthMm);
      if (v.panel) this.chosenPanel.set(v.panel);
      if (v.image) this.activeImage.set(v.image);
    }
  }

  chooseHeight(p: Product, value: number) {
    this.chosenHeight.set(value);
    const matching = (p.variants || []).filter(x => x.heightMm === value);
    if (matching.length > 0) {
      const hasCurrentWidth = matching.some(x => x.widthMm === this.chosenWidth());
      if (!hasCurrentWidth && matching[0].widthMm) {
        this.chosenWidth.set(matching[0].widthMm);
      }
      const v = matching.find(x => x.widthMm === this.chosenWidth()) || matching[0];
      if (v.panel) this.chosenPanel.set(v.panel);
      if (v.image) this.activeImage.set(v.image);
      return;
    }

    const siblings = this.siblingProducts(p);
    const target = siblings.find(sp =>
      (sp.variants || []).some(v => v.heightMm === value) ||
      this.extractHeightFromName(sp) === value
    );
    if (target) {
      this.selected.set(target);
      const targetVariants = target.variants || [];
      const hasWidth = targetVariants.some(x => x.widthMm === this.chosenWidth());
      if (!hasWidth && targetVariants[0]?.widthMm) {
        this.chosenWidth.set(targetVariants[0].widthMm);
      }
      const v = targetVariants.find(x => x.widthMm === this.chosenWidth()) || targetVariants[0];
      if (v?.panel) this.chosenPanel.set(v.panel);
      if (v?.image) this.activeImage.set(v.image);
      else if (target.image) this.activeImage.set(target.image);
      this.updateProductSeo(target);
    }
  }

  chooseWidth(p: Product, value: number) {
    this.chosenWidth.set(value);
    const v = (p.variants || []).find(x => 
      (!this.chosenHeight() || x.heightMm === this.chosenHeight()) && x.widthMm === value
    ) || (p.variants || []).find(x => x.widthMm === value);
    if (v?.image) this.activeImage.set(v.image);
    if (v?.panel) this.chosenPanel.set(v.panel);
  }

  choosePanel(p: Product, value: string) {
    this.chosenPanel.set(value);
    const matching = (p.variants || []).filter(x => x.panel === value);
    if (matching.length > 0) {
      const v = matching[0];
      if (v.heightMm) this.chosenHeight.set(v.heightMm);
      if (v.widthMm) this.chosenWidth.set(v.widthMm);
      if (v.image) this.activeImage.set(v.image);
    }
  }

  previewCardColour(p: Product, c: string) {
    const v = p.variants?.find(x => x.colour === c && x.image);
    if (v?.image) {
      (p as any)._previewImage = v.image;
    }
  }

  activeCardImage(p: Product): string {
    return (p as any)._previewImage || p.image || p.variants?.find(v => v.image)?.image || '';
  }

  colourCss(colour: string): string {
    const c = (colour || '').toLowerCase();
    if (c.includes('white')) return '#ffffff';
    if (c.includes('black')) return '#111827';
    if (c.includes('anthracite') || c.includes('grey') || c.includes('gray')) return '#282a2e';
    if (c.includes('brass') || c.includes('gold')) return '#c5a059';
    if (c.includes('chrome') || c.includes('silver')) return '#d1d5db';
    if (c.includes('bronze') || c.includes('copper')) return '#b36b48';
    return '#6b7280';
  }

  imageSrc(value?: string | null): string {
    return value?.trim() || '/product-placeholder.svg';
  }

  hasImage(p: Product): boolean {
    return !!(p.image || p.variants?.some(v => v.image));
  }

  displayPrice(p: Product): number {
    const prices = [p.price, ...(p.variants || []).map(v => v.price)].filter(v => Number(v) > 0);
    return prices.length ? Math.min(...prices) : 0;
  }

  activePrice(p: Product): number {
    return this.chosenVariant()?.price ?? p.price;
  }

  exVatPrice(p: Product): number {
    return Math.round((this.activePrice(p) / 1.2) * 100) / 100;
  }

  activeDiscountPercent(p: Product): number {
    const v = this.chosenVariant();
    if (v && v.discountPercent !== undefined && v.discountPercent !== null) {
      return Number(v.discountPercent) || 0;
    }
    return Number(p.discountPercent) || 0;
  }

  wasPrice(p: Product): number {
    const current = this.activePrice(p);
    const disc = this.activeDiscountPercent(p);
    if (!disc || disc <= 0 || disc >= 100) {
      return current;
    }
    return Math.round(current / (1 - (disc / 100)));
  }

  savingsAmount(p: Product): number {
    return Math.max(0, this.wasPrice(p) - this.activePrice(p));
  }

  savingsPercent(p: Product): number {
    return this.activeDiscountPercent(p);
  }

  currentBtu(p: Product): number {
    return this.chosenVariant()?.btu || p.btu || 0;
  }

  currentWatts(p: Product): number {
    return this.chosenVariant()?.watts || p.watts || 0;
  }

  currentBtu60(p: Product): number {
    return Math.round((this.currentBtu(p) || 0) * 1.264);
  }

  currentHeight(p: Product): number {
    return this.chosenHeight() || this.chosenVariant()?.heightMm || p.variants?.[0]?.heightMm || this.extractHeightFromName(p) || 600;
  }

  currentWidth(p: Product): number {
    return this.chosenVariant()?.widthMm || p.variants?.[0]?.widthMm || 800;
  }

  currentDepth(p: Product): number {
    return this.chosenVariant()?.depthMm || p.variants?.[0]?.depthMm || 100;
  }

  currentSku(p: Product): string {
    return this.chosenVariant()?.variantSku || p.sku;
  }

  currentEan(p: Product): string {
    return this.chosenVariant()?.ean || `5055${String(p.id).padStart(3, '0')}00001`;
  }

  currentPanel(p: Product): string {
    return this.chosenVariant()?.panel || (p as any).panel || 'Double Convector (Type 22)';
  }

  currentPipeCentres(p: Product): string {
    const w = this.currentWidth(p);
    return `${w - 90} mm (or ${w} mm with bottom tapping)`;
  }

  currentWallToPipe(p: Product): string {
    const panel = this.currentPanel(p).toLowerCase();
    if (panel.includes('11') || panel.includes('single convector') || panel.includes('sf')) return '43 – 58 mm';
    if (panel.includes('21') || panel.includes('hf')) return '65 – 80 mm';
    if (panel.includes('22') || panel.includes('df') || panel.includes('double convector')) return '73 – 88 mm';
    return '50 – 70 mm';
  }

  currentWallToFace(p: Product): string {
    const d = this.currentDepth(p);
    return `${d + 35} mm`;
  }

  roomCoverage(p: Product): string {
    const btu = this.currentBtu(p);
    if (btu <= 0) return 'N/A (Accessory / Valve)';
    const minSq = Math.max(3, Math.round(btu / 380));
    const maxSq = Math.max(minSq + 2, Math.round(btu / 310));
    return `approx. ${minSq} – ${maxSq} m² (Standard 2.4m Ceiling)`;
  }

  selectPdpTab(tab: 'overview' | 'specs' | 'diagram' | 'delivery' | 'valves' | 'reviews') {
    this.activePdpTab.set(tab);
    if (tab === 'specs') {
      setTimeout(() => {
        document.getElementById('pdp-reviews-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 50);
    }
  }

  approvedReviews(): ProductReview[] {
    return this.reviews().filter(r => r.status === 'APPROVED' || !r.status);
  }

  productReviews(p: Product): ProductReview[] {
    if (!p || !p.id) return [];
    return this.reviews().filter(r => {
      // Must strictly belong to this product ID
      if (r.productId !== p.id) return false;
      const isApproved = r.status === 'APPROVED' || !r.status;
      const isMyPending = r.status === 'PENDING_APPROVAL' && (r.customerKey === this.customerKey);
      return isApproved || isMyPending || this.isAdmin();
    });
  }

  averageRating(p: Product): number {
    const revs = this.productReviews(p).filter(r => r.status === 'APPROVED' || !r.status);
    if (!revs.length) return 0;
    const sum = revs.reduce((acc, r) => acc + r.rating, 0);
    return Math.round((sum / revs.length) * 10) / 10;
  }

  productRating(p: Product): number {
    return this.averageRating(p);
  }

  productReviewCount(p: Product): number {
    return this.productReviews(p).filter(r => r.status === 'APPROVED' || !r.status).length;
  }

  overallAverageRating(): number {
    const revs = this.approvedReviews();
    if (!revs.length) return 5.0;
    const sum = revs.reduce((acc, r) => acc + r.rating, 0);
    return Math.round((sum / revs.length) * 10) / 10;
  }

  totalReviewsCount(): number {
    return this.approvedReviews().length;
  }

  formatReviewDate(r: ProductReview): string {
    if (r.date) return r.date;
    if (r.createdAt) {
      try {
        const d = new Date(r.createdAt);
        return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
      } catch {
        return 'Recently';
      }
    }
    return 'Recently';
  }

  ratingBreakdown(p: Product): { star: number; count: number; percent: number }[] {
    const revs = this.productReviews(p).filter(r => r.status === 'APPROVED' || !r.status);
    const total = revs.length;
    const stars = [5, 4, 3, 2, 1];
    return stars.map(star => {
      const count = revs.filter(r => Math.round(r.rating) === star).length;
      return {
        star,
        count,
        percent: total > 0 ? Math.round((count / total) * 100) : 0
      };
    });
  }

  percentRecommended(p: Product): number {
    const revs = this.productReviews(p).filter(r => r.status === 'APPROVED' || !r.status);
    if (!revs.length) return 0;
    const positive = revs.filter(r => r.rating >= 4).length;
    return Math.round((positive / revs.length) * 100);
  }

  filteredReviews(p: Product): ProductReview[] {
    const list = this.productReviews(p);
    const filter = this.reviewFilterRating();
    if (filter === null) return list;
    return list.filter(r => Math.round(r.rating) === filter);
  }

  toggleHelpful(reviewId: string | number) {
    this.reviews.update(list => list.map(r => {
      if (r.id === reviewId) {
        const alreadyClicked = r.isHelpfulClicked;
        return {
          ...r,
          helpfulCount: alreadyClicked ? Math.max(0, r.helpfulCount - 1) : r.helpfulCount + 1,
          isHelpfulClicked: !alreadyClicked
        };
      }
      return r;
    }));

    if (typeof reviewId === 'number' || (typeof reviewId === 'string' && /^\d+$/.test(reviewId))) {
      this.http.post(`/api/reviews/${reviewId}/helpful`, {}).subscribe({
        error: () => {}
      });
    }
  }

  openReviewModal() {
    this.isReviewModalOpen.set(true);
  }

  closeReviewModal() {
    this.isReviewModalOpen.set(false);
  }

  setReviewRating(rating: number) {
    this.newReviewRating.set(rating);
  }

  submitReview(p: Product) {
    if (this.isReviewSubmitting()) return;
    if (this.rateLimitActive()) {
      this.showToast(`Rate limit active. Please wait ${this.rateLimitSeconds()}s before submitting.`);
      return;
    }
    const author = this.newReviewAuthor().trim() || 'Verified UK Customer';
    const location = this.newReviewLocation().trim() || 'United Kingdom';
    const title = this.newReviewTitle().trim() || 'Great radiator!';
    const comment = this.newReviewComment().trim();

    if (!comment) {
      this.showToast('Please enter your review feedback.');
      return;
    }

    this.isReviewSubmitting.set(true);

    const payload = {
      productId: p.id,
      category: p.category,
      author,
      authorEmail: this.newReviewAuthorEmail().trim() || localStorage.getItem('email') || '',
      customerKey: this.customerKey,
      location,
      role: this.newReviewRole(),
      rating: this.newReviewRating(),
      title,
      comment
    };

    this.http.post<ProductReview>('/api/reviews', payload).subscribe({
      next: (savedRev) => {
        this.isReviewSubmitting.set(false);
        savedRev.customerKey = this.customerKey;
        savedRev.status = savedRev.status || 'PENDING_APPROVAL';
        this.reviews.update(existing => [savedRev, ...existing.filter(e => e.id !== savedRev.id)]);
        this.closeReviewModal();
        this.newReviewAuthor.set('');
        this.newReviewAuthorEmail.set('');
        this.newReviewLocation.set('');
        this.newReviewTitle.set('');
        this.newReviewComment.set('');
        this.showToast('Thank you! Your review has been submitted and is pending admin approval.');
        this.selectPdpTab('reviews');
      },
      error: () => {
        this.isReviewSubmitting.set(false);
        const localRev: ProductReview = {
          id: 'rev-' + Date.now(),
          productId: p.id,
          category: p.category,
          author,
          authorEmail: this.newReviewAuthorEmail().trim() || localStorage.getItem('email') || '',
          customerKey: this.customerKey,
          location,
          role: this.newReviewRole(),
          rating: this.newReviewRating(),
          date: 'Just now',
          title,
          comment,
          status: 'PENDING_APPROVAL',
          verifiedPurchase: true,
          helpfulCount: 0,
          isHelpfulClicked: false
        };
        this.reviews.update(existing => [localRev, ...existing]);
        this.closeReviewModal();
        this.newReviewAuthor.set('');
        this.newReviewAuthorEmail.set('');
        this.newReviewLocation.set('');
        this.newReviewTitle.set('');
        this.newReviewComment.set('');
        this.showToast('Thank you! Your review has been submitted and is pending admin approval.');
        this.selectPdpTab('reviews');
      }
    });
  }

  approveReview(r: ProductReview) {
    this.http.post<ProductReview>(`/api/reviews/${r.id}/approve`, {}).subscribe({
      next: () => {
        this.reviews.update(list => list.map(item => item.id === r.id ? { ...item, status: 'APPROVED' } : item));
        this.showToast('Review approved and published to all customers.');
      },
      error: () => {
        this.reviews.update(list => list.map(item => item.id === r.id ? { ...item, status: 'APPROVED' } : item));
        this.showToast('Review approved.');
      }
    });
  }

  rejectReview(r: ProductReview) {
    this.http.post<ProductReview>(`/api/reviews/${r.id}/reject`, {}).subscribe({
      next: () => {
        this.reviews.update(list => list.map(item => item.id === r.id ? { ...item, status: 'REJECTED' } : item));
        this.showToast('Review rejected.');
      },
      error: () => {
        this.reviews.update(list => list.map(item => item.id === r.id ? { ...item, status: 'REJECTED' } : item));
        this.showToast('Review rejected.');
      }
    });
  }

  scrollToReviews() {
    this.activePdpTab.set('reviews');
    setTimeout(() => {
      const el = document.getElementById('pdp-reviews-section');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 50);
  }

  galleryImageLabel(img: string, index: number): string {
    const lower = img.toLowerCase();
    if (lower.includes('dimension') || lower.includes('schematic') || lower.includes('blueprint')) return '📐 Dimensions';
    if (lower.includes('6808f569') || lower.includes('0713728c') || lower.includes('712218f0') || lower.includes('325c65f7') || lower.includes('54f742c6') || lower.includes('c6000001') || lower.includes('c6000002') || lower.includes('c6000003')) return 'Lifestyle';
    if (lower.includes('00def179') || lower.includes('25cfc707') || lower.includes('3b09bd8d') || lower.includes('fc274807') || lower.includes('1c3078f3')) return 'Elevation';
    if (lower.includes('7272ca03')) return '3D Angle';
    if (lower.includes('c6610283') || lower.includes('be9acb92')) return 'Top Grille';
    if (lower.includes('edd80447')) return 'Tappings';
    return `Angle ${index + 1}`;
  }

  addMatchingValves() {
    const valve = this.products().find(p => p.name.includes('Valve') || p.category === 'Valves & Accessories');
    if (valve) {
      this.add(valve);
      this.showToast('Added matching Angled TRV Valve Set to your basket!');
    } else {
      this.showToast('Added matching TRV Valves (+£29.99) to basket!');
    }
  }

  imageFailed(event: Event) {
    const img = event.target as HTMLImageElement;
    const attempted = (img as any)._retried;
    if (!attempted) {
      (img as any)._retried = true;
      if (img.src.endsWith('.jpg')) {
        img.src = img.src.slice(0, -4) + '.png';
        return;
      }
      if (img.src.endsWith('.png')) {
        img.src = img.src.slice(0, -4) + '.jpg';
        return;
      }
    }
    if (!img.src.endsWith('/product-placeholder.svg')) {
      img.src = '/product-placeholder.svg';
    }
  }

  decreaseQty() {
    this.productQty.update(v => Math.max(1, v - 1));
  }

  increaseQty() {
    this.productQty.update(v => Math.min(10, v + 1));
  }

  add(p: Product) {
    this.addToCart(p, 1);
  }

  getCartQty(p: Product): number {
    if (!p) return 0;
    return this.cart()
      .filter(l => l.product.id === p.id)
      .reduce((sum, l) => sum + l.quantity, 0);
  }

  incrementCartQty(p: Product, event?: Event) {
    if (event) {
      event.stopPropagation();
    }
    this.addToCart(p, 1);
  }

  decrementCartQty(p: Product, event?: Event) {
    if (event) {
      event.stopPropagation();
    }
    const currentLines = this.cart().filter(l => l.product.id === p.id);
    if (currentLines.length === 0) return;

    const lastLine = currentLines[currentLines.length - 1];
    if (lastLine.quantity > 1) {
      lastLine.quantity -= 1;
      this.touchCart();
      this.showToast(`Updated basket: ${p.name}`, 'cart');
    } else {
      this.removeLine(lastLine);
      this.showToast(`Removed from basket: ${p.name}`, 'cart');
    }
  }

  addMany(p: Product) {
    this.addToCart(p, this.productQty());
  }

  addToCart(p: Product, quantity: number) {
    const isPdp = this.selected()?.id === p.id;
    const variant = isPdp ? this.chosenVariant() || undefined : p.variants?.[0];
    const chosenColour = isPdp ? (this.chosenColour() || p.colour || 'Traffic White (RAL 9016)') : (p.colour || 'Traffic White (RAL 9016)');
    const chosenHeight = isPdp ? this.currentHeight(p) : (variant?.heightMm || p.variants?.[0]?.heightMm);
    const chosenWidth = isPdp ? this.currentWidth(p) : (variant?.widthMm || p.variants?.[0]?.widthMm);

    const found = this.cart().find(l =>
      l.product.id === p.id &&
      l.variant?.id === variant?.id &&
      l.chosenColour === chosenColour &&
      l.chosenHeight === chosenHeight &&
      l.chosenWidth === chosenWidth
    );
    if (found) {
      found.quantity += quantity;
    } else {
      this.cart.update(v => [...v, { product: p, variant, quantity, chosenColour, chosenHeight, chosenWidth }]);
    }
    this.touchCart();
    this.showToast(`Added to basket: ${p.name}`, 'cart');
  }

  removeLine(line: Line) {
    this.cart.update(v => v.filter(l => l !== line));
    this.touchCart();
  }

  linePrice(line: Line): number {
    return line.variant?.price ?? line.product.price;
  }

  touchCart() {
    this.cart.set([...this.cart()]);
    this.save('cart', this.cart());
  }

  isSaved(p: Product): boolean {
    return this.wishlist().some(x => x.id === p.id);
  }

  toggleWishlist(p: Product) {
    if (this.isSaved(p)) {
      this.wishlist.update(v => v.filter(x => x.id !== p.id));
      this.showToast(`Removed from wishlist: ${p.name}`);
    } else {
      this.wishlist.update(v => [...v, p]);
      this.showToast(`Saved to wishlist: ${p.name}`, 'wishlist');
    }
    this.save('wishlist', this.wishlist());
  }

  // Auth & Account
  setAuthMode(mode: 'login' | 'signup' | 'forgot' | 'reset') {
    this.authMode.set(mode);
    this.error.set('');
    this.success.set('');
  }

  openAccount() {
    try {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      document.documentElement.scrollTop = 0;
    } catch (_) {}
    if (this.sessionAuth) {
      this.loadAccount();
    } else {
      this.setAuthMode('login');
      this.view.set('login');
    }
  }

  openWishlist() {
    try {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      document.documentElement.scrollTop = 0;
    } catch (_) {}
    this.view.set('wishlist');
  }

  openCart() {
    try {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      document.documentElement.scrollTop = 0;
    } catch (_) {}
    this.view.set('cart');
  }

  clearWishlist() {
    this.wishlist.set([]);
    this.save('wishlist', []);
    this.showToast('Wishlist cleared');
  }

  moveAllWishlistToCart() {
    const items = this.wishlist();
    if (!items.length) return;
    items.forEach(p => this.add(p));
    this.showToast(`Added ${items.length} item(s) to basket!`, 'cart');
  }

  login() {
    if (this.authSubmitting()) return;
    if (this.rateLimitActive()) {
      this.error.set(`Rate limit active. Please wait ${this.rateLimitSeconds()} seconds before trying again.`);
      return;
    }
    this.error.set('');
    this.authSubmitting.set(true);
    this.http.post<any>('/api/auth/login', {
      email: this.email ? this.email.trim() : '',
      password: this.password
    }).subscribe({
      next: (v: any) => {
        this.authSubmitting.set(false);
        const token = v.token || btoa(`${this.email}:${this.password}`);
        this.inMemoryAuth.set(token);
        sessionStorage.removeItem('auth');
        localStorage.setItem('email', this.email);
        this.accountName.set(v.fullName || 'Customer');
        this.savedAddresses.set(this.read<SavedAddress[]>(this.addressStorageKey, []));
        if (this.checkoutPending) {
          this.view.set('checkout');
        } else {
          this.loadAccount();
        }
      },
      error: (err: any) => {
        this.authSubmitting.set(false);
        if (err?.status === 429) {
          this.error.set('Too many login attempts. Please wait 60 seconds before trying again.');
        } else if (err?.status === 403) {
          this.error.set(err?.error?.message || 'Your account has been deactivated by administration. Please contact sales@theheatingandplumbing.com.');
        } else {
          this.error.set(err?.error?.message || 'Invalid email or password.');
        }
      }
    });
  }

  requestPasswordReset() {
    if (this.authSubmitting()) return;
    this.error.set('');
    this.success.set('');
    if (!this.email || !this.email.includes('@')) {
      this.error.set('Please enter a valid email address.');
      return;
    }
    this.authSubmitting.set(true);
    this.http.post<any>('/api/auth/forgot-password', { email: this.email.trim() }).subscribe({
      next: (res: any) => {
        this.authSubmitting.set(false);
        if (res.devCode) {
          this.resetDevCode.set(res.devCode);
          this.resetCode.set(res.devCode);
          this.success.set(`Verification code generated: ${res.devCode}. Enter your new password below.`);
        } else {
          this.success.set(res.message || 'Verification code sent to your email.');
        }
        this.authMode.set('reset');
      },
      error: (err: any) => {
        this.authSubmitting.set(false);
        this.error.set(err?.error?.message || 'Could not process password reset request.');
      }
    });
  }

  confirmPasswordReset() {
    if (this.authSubmitting()) return;
    this.error.set('');
    this.success.set('');
    const code = this.resetCode().trim();
    const newPass = this.newPassword().trim();
    const confirmPass = this.confirmNewPassword().trim();

    if (!code) {
      this.error.set('Please enter the 6-digit verification code.');
      return;
    }
    if (!newPass || newPass.length < 6) {
      this.error.set('New password must be at least 6 characters long.');
      return;
    }
    if (newPass !== confirmPass) {
      this.error.set('Passwords do not match.');
      return;
    }

    this.authSubmitting.set(true);
    this.http.post<any>('/api/auth/reset-password', {
      email: this.email.trim(),
      code: code,
      newPassword: newPass
    }).subscribe({
      next: (res: any) => {
        this.authSubmitting.set(false);
        this.password = newPass;
        this.success.set('Password successfully reset! Signing you in…');
        setTimeout(() => {
          this.login();
        }, 600);
      },
      error: (err: any) => {
        this.authSubmitting.set(false);
        this.error.set(err?.error?.message || 'Failed to reset password. Please check your verification code.');
      }
    });
  }

  signup() {
    if (this.authSubmitting()) return;
    if (this.rateLimitActive()) {
      this.error.set(`Rate limit active. Please wait ${this.rateLimitSeconds()} seconds before trying again.`);
      return;
    }
    this.error.set('');
    if (!this.fullName || this.fullName.trim().length < 2) {
      this.error.set('Please enter your full name (minimum 2 characters).');
      return;
    }
    if (!this.email || !this.email.includes('@') || !this.email.includes('.')) {
      this.error.set('Please enter a valid email address.');
      return;
    }
    if (!this.password || this.password.length < 6) {
      this.error.set('Password must be at least 6 characters long.');
      return;
    }
    if (this.password !== this.confirmPassword) {
      this.error.set('Passwords do not match.');
      return;
    }
    this.authSubmitting.set(true);
    this.http.post<any>('/api/auth/signup', {
      fullName: this.fullName.trim(),
      email: this.email.trim(),
      password: this.password
    }).subscribe({
      next: () => {
        this.authSubmitting.set(false);
        this.success.set('Account created successfully! Signing in…');
        this.login();
      },
      error: e => {
        this.authSubmitting.set(false);
        if (e.status === 429) {
          this.error.set('Too many signup attempts. Please wait 60 seconds before trying again.');
        } else if (e.status === 409) {
          this.error.set('An account already exists for this email address. Please sign in.');
        } else if (e.status === 0) {
          this.error.set('Unable to connect to backend server. Please verify the API service is running on port 8080.');
        } else if (e.error?.detail) {
          this.error.set(e.error.detail);
        } else if (e.error?.errors && Array.isArray(e.error.errors) && e.error.errors.length > 0) {
          this.error.set(e.error.errors[0].defaultMessage || 'Please check your details.');
        } else if (e.error?.message && typeof e.error.message === 'string' && !e.error.message.startsWith('Validation failed')) {
          this.error.set(e.error.message);
        } else {
          this.error.set('Could not create account. Please check your details and try again.');
        }
      }
    });
  }

  expressBuyNow(p: Product) {
    const variant = this.selected()?.id === p.id ? this.chosenVariant() || undefined : p.variants?.[0];
    const found = this.cart().find(l => l.product.id === p.id && l.variant?.id === variant?.id);
    if (found) {
      found.quantity += this.productQty();
    } else {
      this.cart.update(v => [...v, { product: p, variant, quantity: this.productQty() }]);
    }
    this.touchCart();
    this.beginCheckout();
  }

  beginCheckout() {
    this.clearAllCheckoutErrors();
    if (this.savedAddresses().length > 0 && !this.addressLine) {
      const def = this.savedAddresses()[0];
      this.checkoutName = def.name;
      this.checkoutPhone = def.phone;
      this.addressLine = def.addressLine;
      this.city = def.city;
      this.postcode = def.postcode;
      this.selectedAddressId.set(def.id);
    }
    if (this.sessionAuth && !this.checkoutName) {
      const authName = (this.fullName || this.accountName() || '').trim();
      if (authName && authName.toLowerCase() !== 'customer' && authName.toLowerCase() !== 'cusmtomer') {
        this.checkoutName = authName;
      }
    }
    // Ensure default placeholder names and emails remain completely empty
    if (this.email === 'customer@example.com') {
      this.email = '';
    }
    if (this.checkoutName.toLowerCase() === 'customer' || this.checkoutName.toLowerCase() === 'cusmtomer') {
      this.checkoutName = '';
    }
    if (this.postcode) {
      const check = this.checkUkRestrictedPostcode(this.postcode);
      if (check.restricted) {
        this.restrictedPostcodeInfo.set(check);
        this.postcodeError.set(`Restricted UK Delivery Area (${check.region}). Standard online courier delivery is unavailable.`);
      }
    }
    // Guest & logged-in checkout directly proceeds without requiring login
    this.view.set('checkout');
    scrollTo({ top: 0, behavior: 'smooth' });
  }

  // Promo / Coupon Management
  applyCoupon() {
    this.couponError.set('');
    const code = (this.couponCode || '').trim().toUpperCase();
    if (!code) {
      this.couponError.set('Please enter a coupon or promo code.');
      return;
    }
    this.http.post<any>('/api/promotions/validate', {
      code,
      subtotal: this.subtotal()
    }).subscribe({
      next: (res) => {
        if (res.valid) {
          this.appliedCoupon.set({
            code: res.code,
            label: res.label,
            discountAmount: res.discount,
            freeShipping: res.freeShipping
          });
          this.showToast(`Voucher ${res.code} applied!`);
        } else {
          this.couponError.set(res.message || 'Invalid promotion code.');
        }
      },
      error: (err) => {
        // Built-in fallback
        if (code === 'WELCOME10') {
          this.appliedCoupon.set({ code: 'WELCOME10', label: '10% Welcome Discount', discountPercent: 10 });
          this.showToast('Promo code WELCOME10 applied (10% off)!');
        } else if (code === 'HEAT20') {
          if (this.subtotal() < 150) {
            this.couponError.set('HEAT20 requires a minimum basket value of £150.');
            return;
          }
          this.appliedCoupon.set({ code: 'HEAT20', label: '£20 Heating Season Voucher', discountAmount: 20 });
          this.showToast('Voucher HEAT20 applied (£20 off)!');
        } else if (code === 'FREESHIP') {
          this.appliedCoupon.set({ code: 'FREESHIP', label: 'Free Express UK Delivery', freeShipping: true });
          this.showToast('Promo code FREESHIP applied (Free UK Delivery)!');
        } else if (code === 'TRADE15') {
          this.appliedCoupon.set({ code: 'TRADE15', label: '15% Heating Engineer Trade Discount', discountPercent: 15 });
          this.showToast('Trade discount code TRADE15 applied (15% off)!');
        } else {
          this.couponError.set(err.error?.message || 'Invalid code. Try WELCOME10, HEAT20, or FREESHIP');
        }
      }
    });
  }

  removeCoupon() {
    this.appliedCoupon.set(null);
    this.couponCode = '';
    this.couponError.set('');
    this.showToast('Discount code removed.');
  }

  // Address Book Management
  selectSavedAddress(addr: SavedAddress) {
    this.selectedAddressId.set(addr.id);
    this.checkoutName = addr.name;
    this.checkoutPhone = addr.phone;
    this.addressLine = addr.addressLine;
    this.city = addr.city;
    this.postcode = addr.postcode;
    this.showToast(`Selected "${addr.label}" address`);
  }

  saveNewAddress() {
    if (!this.newAddressLine.trim() || !this.newAddressCity.trim() || !this.newAddressPostcode.trim()) {
      this.showToast('Please provide street address, city, and postcode.');
      return;
    }
    const newAddr: SavedAddress = {
      id: 'addr-' + Date.now(),
      label: this.newAddressLabel.trim() || 'Additional Address',
      name: this.newAddressName.trim() || this.checkoutName || this.fullName || 'Customer',
      phone: this.newAddressPhone.trim() || this.checkoutPhone || '',
      addressLine: this.newAddressLine.trim(),
      city: this.newAddressCity.trim(),
      postcode: this.newAddressPostcode.trim().toUpperCase()
    };
    const updated = [...this.savedAddresses(), newAddr];
    this.savedAddresses.set(updated);
    this.save(this.addressStorageKey, updated);
    this.selectSavedAddress(newAddr);
    this.isAddingAddress.set(false);
    this.newAddressLabel = '';
    this.newAddressLine = '';
    this.newAddressCity = '';
    this.newAddressPostcode = '';
    this.showToast('New address saved to your account!');
  }

  deleteSavedAddress(id: string) {
    const updated = this.savedAddresses().filter(a => a.id !== id);
    this.savedAddresses.set(updated);
    this.save(this.addressStorageKey, updated);
    this.showToast('Address removed.');
  }

  // Order Consignment Tracking
  openTracking(o: Order) {
    this.trackingOrder.set(o);
    const num = o.orderNumber || o.id;
    if (num) {
      this.http.get<Order>(`/api/orders/track/${encodeURIComponent(num)}`).subscribe({
        next: updated => {
          if (updated && (this.trackingOrder()?.id === o.id || this.trackingOrder()?.orderNumber === o.orderNumber)) {
            this.trackingOrder.set({ ...this.trackingOrder()!, ...updated });
          }
        },
        error: () => {}
      });
    }
  }

  closeTracking() {
    this.trackingOrder.set(null);
  }

  // Guest & Universal Order Tracking Lookup
  openTrackLookup(prefillQuery?: string) {
    if (prefillQuery) {
      this.trackLookupQuery = prefillQuery;
    }
    this.trackLookupError.set('');
    this.trackLookupModalOpen.set(true);
  }

  closeTrackLookup() {
    this.trackLookupModalOpen.set(false);
    this.trackLookupError.set('');
  }

  submitTrackLookup() {
    const q = this.trackLookupQuery.trim();
    if (!q) {
      this.trackLookupError.set('Please enter your order reference (e.g. ORD-2026-00104) or carrier consignment number.');
      return;
    }
    this.trackLookupLoading.set(true);
    this.trackLookupError.set('');
    this.http.get<Order>(`/api/orders/track/${encodeURIComponent(q)}`).subscribe({
      next: order => {
        this.trackLookupLoading.set(false);
        if (order && (order.orderNumber || order.id)) {
          this.trackLookupModalOpen.set(false);
          this.openTracking(order);
        } else {
          this.trackLookupError.set(`No consignment found for "${q}". Please double check your order number.`);
        }
      },
      error: () => {
        this.trackLookupLoading.set(false);
        this.trackLookupError.set(`No order found matching "${q}". Please check the reference in your email confirmation.`);
      }
    });
  }

  // Floating Support & WhatsApp Widget & Complaint Claims
  toggleSupportWidget() {
    this.supportWidgetOpen.update(v => !v);
  }

  openSupportWidget(tab: 'callback' | 'claim' | 'track' = 'callback') {
    this.supportWidgetOpen.set(true);
    this.setSupportWidgetTab(tab);
  }

  setSupportWidgetTab(tab: 'callback' | 'claim' | 'track') {
    this.supportWidgetTab.set(tab);
    this.lastSubmittedTicket.set(null);
    if (tab === 'track' && !this.trackingTicketResult() && this.trackingTicketInput()) {
      this.trackTicketByNumber();
    }
  }

  trackTicketByNumber(ticketRef?: string) {
    const ref = (ticketRef || this.trackingTicketInput()).trim();
    if (!ref) {
      this.trackingTicketError.set('Please enter a ticket reference (e.g. TKT-2026-33885)');
      return;
    }
    this.trackingTicketLoading.set(true);
    this.trackingTicketError.set('');
    this.trackingTicketResult.set(null);
    this.http.get<any>(`/api/inquiries/track/${encodeURIComponent(ref)}`).subscribe({
      next: res => {
        this.trackingTicketLoading.set(false);
        this.trackingTicketResult.set(res);
      },
      error: err => {
        this.trackingTicketLoading.set(false);
        this.trackingTicketError.set(err.error?.error || `Ticket #${ref} could not be found. Please check your reference number.`);
      }
    });
  }

  openTicketTracker(ticketRef?: string) {
    if (ticketRef) {
      this.trackingTicketInput.set(ticketRef);
    }
    this.supportWidgetOpen.set(true);
    this.supportWidgetTab.set('track');
    this.lastSubmittedTicket.set(null);
    this.trackTicketByNumber(ticketRef || this.trackingTicketInput());
  }


  onInquiryFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      this.showToast('File too large (maximum 10 MB)');
      return;
    }
    this.supportUploading.set(true);
    const form = new FormData();
    form.append('file', file);
    this.http.post<any>('/api/inquiries/upload', form).subscribe({
      next: res => {
        this.supportUploading.set(false);
        this.supportAttachmentUrl.set(res.url);
        this.supportAttachmentFilename.set(res.filename || file.name);
        this.showToast('Attachment uploaded successfully!');
      },
      error: () => {
        this.supportUploading.set(false);
        this.showToast('Could not upload attachment. Please select a JPG, PNG, or PDF file.');
      }
    });
  }

  removeSupportAttachment() {
    this.supportAttachmentUrl.set('');
    this.supportAttachmentFilename.set('');
  }

  openOrderComplaint(order: any) {
    this.supportWidgetOpen.set(true);
    this.supportWidgetTab.set('claim');
    this.lastSubmittedTicket.set(null);
    this.supportQueryOrderNumber = order.orderNumber || (order.id ? '#' + order.id.slice(0, 8).toUpperCase() : '');
    this.supportQueryCategory = 'Damaged in Delivery';
    this.supportQueryName = this.accountName() || this.fullName || this.checkoutName || '';
    this.supportQueryEmail = this.email || '';
    this.supportQueryPhone = this.checkoutPhone || '';
    if (order.items && order.items.length) {
      this.supportQueryProduct = order.items.map((i: any) => i.name).join(', ');
    }
  }

  submitSupportQuery() {
    if (!this.supportQueryMessage.trim()) {
      this.showToast('Please enter your inquiry or describe the issue.');
      return;
    }
    const emailToUse = this.supportQueryEmail.trim() || this.email.trim();
    if (this.supportWidgetTab() === 'claim' && !emailToUse) {
      this.showToast('Please provide your email address for ticket updates.');
      return;
    }

    this.supportSubmitted.set(true);
    const payload = {
      name: this.supportQueryName.trim() || this.accountName() || this.fullName.trim() || this.checkoutName.trim() || 'Storefront Customer',
      email: emailToUse,
      phone: this.supportQueryPhone.trim() || this.checkoutPhone.trim(),
      category: this.supportWidgetTab() === 'claim' ? this.supportQueryCategory : 'BTU / Technical Inquiry',
      orderNumber: this.supportQueryOrderNumber.trim(),
      productName: this.supportQueryProduct.trim(),
      attachmentUrl: this.supportAttachmentUrl(),
      attachmentFilename: this.supportAttachmentFilename(),
      message: this.supportQueryMessage.trim()
    };

    const headers = this.sessionAuth ? new HttpHeaders({ Authorization: 'Basic ' + this.sessionAuth }) : undefined;
    this.http.post<any>('/api/inquiries', payload, { headers }).subscribe({
      next: res => {
        this.supportSubmitted.set(false);
        const ticketNum = res?.ticketNumber || ('TKT-2026-' + Math.floor(10000 + Math.random() * 90000));
        this.lastSubmittedTicket.set({
          ticketNumber: ticketNum,
          status: 'NEW',
          message: this.supportQueryMessage.trim()
        });
        this.showToast(`✓ Ticket #${ticketNum} created! Our technical team will follow up.`);
        this.supportQueryMessage = '';
        this.supportAttachmentUrl.set('');
        this.supportAttachmentFilename.set('');
        this.loadCustomerTickets();
      },
      error: () => {
        this.supportSubmitted.set(false);
        this.showToast('Inquiry received! A heating engineer will contact you shortly.');
      }
    });
  }

  isImage(url?: string): boolean {
    if (!url) return false;
    return /\.(jpeg|jpg|png|webp|gif)$/i.test(url) || url.startsWith('data:image/');
  }

  loadCustomerTickets() {
    if (!this.sessionAuth) {
      this.customerTickets.set([]);
      this.loadingCustomerTickets.set(false);
      return;
    }
    this.loadingCustomerTickets.set(true);
    const headers = new HttpHeaders({ Authorization: 'Basic ' + this.sessionAuth });
    this.http.get<any[]>('/api/inquiries/my', { headers }).subscribe({
      next: list => {
        this.customerTickets.set(list || []);
        this.loadingCustomerTickets.set(false);
      },
      error: () => {
        this.loadingCustomerTickets.set(false);
      }
    });
  }

  deliveryDate(): string {
    const d = new Date();
    d.setDate(d.getDate() + 2);
    return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
  }

  placeOrder() {
    if (this.orderSubmitting()) return;
    if (this.rateLimitActive()) {
      this.error.set(`Rate limit active. Please wait ${this.rateLimitSeconds()} seconds before placing your order.`);
      return;
    }
    this.error.set('');
    if (!this.cart().length) {
      this.view.set('cart');
      return;
    }

    const v1 = this.validateName();
    const v2 = this.validateEmail();
    const v3 = this.validatePhone();
    const v4 = this.validateAddress();
    const v5 = this.validateCity();
    const v6 = this.validatePostcode();
    const v7 = this.validateCardName();
    const v8 = this.validateCardNumber();
    const v9 = this.validateCardExpiry();
    const v10 = this.validateCardCvc();
    const v11 = this.validateTerms();

    if (!v1 || !v2 || !v3 || !v4 || !v5 || !v6 || !v7 || !v8 || !v9 || !v10 || !v11) {
      this.error.set('Please check and correct the highlighted fields in red before placing your order.');
      setTimeout(() => {
        const firstInvalid = document.querySelector('.auth-input.is-invalid, .field-error-text');
        if (firstInvalid) {
          firstInvalid.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 50);
      return;
    }

    this.orderSubmitting.set(true);

    const expParts = (this.cardExpiry || '').split('/');
    const expMonth = expParts[0] ? expParts[0].trim() : '';
    const expYear = expParts[1] ? ('20' + expParts[1].trim()).slice(-4) : '';

    const intentPayload = {
      amountMinor: Math.round(this.grandTotal() * 100),
      currency: 'gbp',
      customerEmail: this.email.trim(),
      customerName: this.checkoutName.trim(),
      cardNumber: this.cardNumber.replace(/[\s\-\•]/g, ''),
      cardExpMonth: expMonth,
      cardExpYear: expYear,
      cardCvc: this.cardCvc.trim()
    };

    this.http.post<any>('/api/checkout/stripe/create-payment-intent', intentPayload).subscribe({
      next: (intentRes) => {
        const paymentIntentId = intentRes?.paymentIntentId || ('pi_stripe_' + Date.now());
        this.stripePaymentIntentId.set(paymentIntentId);

        if (intentRes?.status === 'requires_action') {
          // 3D Secure SCA challenge required
          this.orderSubmitting.set(false);
          this.scaPendingIntentId.set(paymentIntentId);
          this.scaClientSecret.set(intentRes.clientSecret || '');
          this.scaError.set('');
          this.scaModalOpen.set(true);
          return;
        }

        this.executeOrderSubmission(paymentIntentId);
      },
      error: (err) => {
        this.orderSubmitting.set(false);
        const code = err.error?.code || err.error?.decline_code;
        const msg = err.error?.message || err.error?.error || 'Payment authorisation failed. Please check your card details and try again.';

        if (code === 'expired_card') {
          this.cardExpiryError.set(msg);
        } else if (code === 'incorrect_cvc') {
          this.cardCvcError.set(msg);
        } else if (code === 'insufficient_funds' || code === 'card_declined' || code === 'lost_card') {
          this.cardNumberError.set(msg);
        }

        this.error.set(msg);
        setTimeout(() => {
          const firstInvalid = document.querySelector('.auth-input.is-invalid, .field-error-text, .auth-alert.error');
          if (firstInvalid) {
            firstInvalid.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }, 50);
      }
    });
  }

  private executeOrderSubmission(stripePaymentIntentId: string) {
    let headers = new HttpHeaders();
    if (this.sessionAuth) {
      headers = headers.set('Authorization', 'Basic ' + this.sessionAuth);
    }
    const shippingAddress = `${this.checkoutName.trim()}, ${this.addressLine.trim()}, ${this.city.trim()} ${this.postcode.trim()}`;

    const orderPayload = {
      items: this.cart().map(l => ({
        productId: l.product.id,
        variantId: l.variant?.id,
        quantity: l.quantity
      })),
      shippingAddress,
      customerName: this.checkoutName.trim(),
      customerEmail: this.email.trim(),
      customerPhone: this.checkoutPhone.trim(),
      discountCode: this.appliedCoupon()?.code || null,
      discountAmount: this.discountTotal() > 0 ? this.discountTotal() : null,
      paymentMethod: 'STRIPE',
      paymentStatus: 'PAID',
      stripePaymentIntentId: stripePaymentIntentId
    };

    this.http.post<Order>('/api/orders', orderPayload, { headers }).subscribe({
      next: order => {
        this.completedOrder.set(order);
        this.cart.set([]);
        this.touchCart();
        this.appliedCoupon.set(null);
        this.orderSubmitting.set(false);
        this.view.set('confirmation');
        scrollTo({ top: 0, behavior: 'smooth' });
      },
      error: (err) => {
        this.orderSubmitting.set(false);
        let msg = err.error?.message;
        if (!msg && err.error?.error) {
          msg = err.error.error;
        }
        if (!msg && typeof err.error === 'string') {
          msg = err.error;
        }
        if (!msg) {
          msg = 'Order could not be processed. Please check your information and try again.';
        }
        this.error.set(msg);
      }
    });
  }

  loadAccount() {
    if (!this.sessionAuth) {
      this.view.set('login');
      return;
    }
    const headers = new HttpHeaders({ Authorization: 'Basic ' + this.sessionAuth });
    this.http.get<any>('/api/me', { headers }).subscribe({
      next: m => {
        this.email = m.email;
        this.accountName.set(m.fullName || 'Customer');
        this.savedAddresses.set(this.read<SavedAddress[]>(this.addressStorageKey, []));
        this.http.get<Order[]>('/api/orders', { headers }).subscribe({
          next: o => this.orders.set(o),
          error: () => {}
        });
        this.loadCustomerTickets();
        this.view.set('account');
      },
      error: () => this.logout()
    });
  }


  applyNavigationData(data: any[]) {
    if (!data || !data.length) return;
    const mapped: NavParentMenu[] = data.map(m => {
      let filterOptions = m.filterOptions;
      if (!filterOptions && m.filterOptionsJson) {
        try { filterOptions = JSON.parse(m.filterOptionsJson); } catch(e){}
      }
      const defaultFilterOptions = {
        showPriceFilter: true,
        showAvailabilityFilter: true,
        showBrandFilter: true,
        showColourFilter: true,
        showBtuFilter: m.category === 'Radiators' || m.category === 'Heated Towel Rails',
        showPanelTypeFilter: m.category === 'Radiators',
        showHeightFilter: m.category === 'Radiators' || m.category === 'Heated Towel Rails',
        showFuelTypeFilter: m.category === 'Heated Towel Rails',
        subcategories: [],
        customFilters: []
      };
      const mergedFilterOptions = {
        ...defaultFilterOptions,
        ...(filterOptions || {})
      };
      if (Array.isArray(mergedFilterOptions.customFilters)) {
        mergedFilterOptions.customFilters = mergedFilterOptions.customFilters.map((cf: any) => ({
          name: cf.name,
          optionsStr: cf.optionsStr || (cf.options ? cf.options.join(', ') : ''),
          options: cf.options?.length ? cf.options : (cf.optionsStr ? cf.optionsStr.split(',').map((s: string) => s.trim()).filter(Boolean) : [])
        }));
      }
      let columns = m.columns;
      if (!columns && m.columnsJson) {
        try { columns = JSON.parse(m.columnsJson); } catch(e){}
      }
      let featuredPromo = m.featuredPromo;
      if (!featuredPromo && m.featuredPromoJson) {
        try { featuredPromo = JSON.parse(m.featuredPromoJson); } catch(e){}
      }
      return {
        id: m.menuId || m.id,
        title: m.title,
        category: m.category,
        icon: m.icon || '📁',
        badge: m.badge || '',
        imageUrl: m.imageUrl || '',
        description: m.description || '',
        filterOptions: mergedFilterOptions,
        columns: columns || [],
        featuredPromo: featuredPromo
      };
    });
    this.navigationMenu = mapped;
    this.dynamicNavigationMenu.set(mapped);
  }

  loadNavigation() {
    this.http.get<any[]>('/api/cms/navigation').pipe(
      catchError(() => this.http.get<any[]>('/api/navigation').pipe(catchError(() => of([]))))
    ).subscribe({
      next: (data) => {
        if (data && data.length) {
          this.applyNavigationData(data);
        } else {
          this.http.get<any[]>('/api/navigation').pipe(catchError(() => of([]))).subscribe(fallbackData => {
            if (fallbackData && fallbackData.length) {
              this.applyNavigationData(fallbackData);
            }
          });
        }
      },
      error: () => {}
    });
  }

  loadBlogs() {
    this.loadingBlogs.set(true);
    const bust = Date.now();
    this.http.get<BlogPost[]>(`/api/blogs?_t=${bust}`).pipe(
      catchError(() => this.http.get<BlogPost[]>(`/blogs.json?_t=${bust}`))
    ).subscribe({
      next: (data) => {
        this.loadingBlogs.set(false);
        if (data && data.length) {
          this.blogs.set(data);
        }
      },
      error: () => {
        this.loadingBlogs.set(false);
      }
    });
  }

  openBlogPage() {
    this.view.set('blog');
    this.selectedBlog.set(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    this.titleService.setTitle('Heating & Plumbing Advice, Guides & Inspiration | THP');
    this.loadBlogs();
  }

  readBlog(post: BlogPost) {
    this.selectedBlog.set(post);
    this.view.set('blog');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    this.titleService.setTitle(`${post.title} | Heat & Plumb Advice | THP`);

    // Fetch freshest version of the article immediately
    const bust = Date.now();
    this.http.get<BlogPost>(`/api/blogs/${encodeURIComponent(post.slug)}?_t=${bust}`).subscribe({
      next: (fresh) => {
        if (fresh && fresh.title) {
          this.selectedBlog.set(fresh);
        }
      },
      error: () => {}
    });
  }

  filterBlogCategory(cat: string) {
    this.blogCategoryFilter.set(cat);
  }

  selectCategoryAndList(cat: string) {
    this.selectedBlog.set(null);
    this.blogCategoryFilter.set(cat);
    this.blogSearchQuery.set('');
    this.view.set('blog');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  filterByTag(tag: string) {
    this.selectedBlog.set(null);
    this.blogSearchQuery.set(tag);
    this.blogCategoryFilter.set('All');
    this.view.set('blog');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  getBlogTagsList(tagsStr?: string): string[] {
    if (!tagsStr) return [];
    return tagsStr.split(',').map(t => t.trim()).filter(Boolean);
  }

  getSanitizedContent(content: string): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(content || '');
  }

  logout() {
    this.inMemoryAuth.set(null);
    sessionStorage.removeItem('auth');
    localStorage.removeItem('email');
    this.savedAddresses.set([]);
    this.view.set('shop');
  }
}

bootstrapApplication(App, {
  providers: [provideHttpClient(withInterceptors([rateLimitInterceptor]))]
}).catch(console.error);
