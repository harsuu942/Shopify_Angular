import {CurrencyPipe, DatePipe} from '@angular/common';
import {HttpClient, HttpHeaders} from '@angular/common/http';
import {Component, computed, inject, signal} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {bootstrapApplication} from '@angular/platform-browser';
import {provideHttpClient} from '@angular/common/http';

interface Product {id:number;sku:string;name:string;brand:string;category:string;description:string;price:number;stock:number;colour:string;finish:string;warrantyYears:number;watts:number;btu:number;image:string}
interface Line {product:Product; quantity:number}
interface Order {id:string;total:number;status:string;createdAt:string}

@Component({
 selector:'app-root', standalone:true, imports:[FormsModule,CurrencyPipe,DatePipe],
 template:`
 <header class="shadow-sm">
  <div class="utility px-3 px-lg-5"><span>Trade prices available</span><span>Free delivery over £500 · Expert help 7 days</span></div>
  <nav class="navbar navbar-expand-lg">
   <button class="brand navbar-brand" (click)="view.set('shop')"><span class="mark">H</span><span>HEARTH <small>& HOME</small></span></button>
   <label class="search input-group"><span class="input-group-text bg-white border-0">⌕</span><input class="form-control border-0" [(ngModel)]="query" (keyup.enter)="load()" placeholder="Search products, brands or SKU"><button class="btn btn-dark px-4" (click)="load()">Search</button></label>
   <div class="actions ms-lg-auto"><button class="btn btn-link text-dark text-decoration-none" (click)="openAccount()">Account</button><button class="btn btn-link text-dark text-decoration-none" (click)="view.set('wishlist')">♡ {{wishlist().length}}</button><button class="basket btn btn-dark" (click)="view.set('cart')">Basket · {{cartCount()}}</button></div>
  </nav>
  <div class="categories nav nav-underline"><button class="nav-link department-trigger" (click)="megaMenu.update(v=>!v)">☰ Shop departments <span>{{megaMenu()?'−':'+'}}</span></button><button class="nav-link" (click)="category='';load()">New & trending</button>@for(c of categories();track c){<button class="nav-link" (click)="category=c;load()">{{c}}</button>}<button class="nav-link">Brands</button><button class="nav-link sale">Offers</button></div>
  @if(megaMenu()){<div class="mega-menu shadow-lg">
   <div class="mega-inner">
    <div><h4>Bathrooms</h4><button (click)="chooseCategory('Bathrooms')">Shop all bathrooms</button><button>Baths</button><button>Showers & enclosures</button><button>Bathroom furniture</button><button>Taps & accessories</button></div>
    <div><h4>Heating</h4><button (click)="chooseCategory('Designer Radiators')">Designer radiators</button><button (click)="chooseCategory('Heated Towel Rails')">Heated towel rails</button><button (click)="chooseCategory('Radiator Valves')">Radiator valves</button><button>Electric heating</button><button>Underfloor heating</button></div>
    <div><h4>Plumbing</h4><button (click)="chooseCategory('Plumbing')">Shop plumbing</button><button>Pipes & fittings</button><button>Pumps</button><button>Water controls</button><button>Tools & consumables</button></div>
    <div><h4>Helpful guides</h4><button>Radiator BTU calculator</button><button>Bathroom buying guide</button><button>Delivery information</button><button>Book a design consultation</button></div>
    <button class="mega-promo" (click)="chooseCategory('Designer Radiators')"><span>Heating event</span><strong>Save up to 30%</strong><small>Shop the edit →</small></button>
   </div>
  </div>}
 </header>

 @if(view()==='shop'){
  <main>
   <section class="hero">
    <div class="col-lg-7"><span class="badge rounded-pill text-bg-light text-dark px-3 py-2 mb-3">THE SUMMER EDIT · SAVE UP TO 30%</span><h1>Make every room<br><em>feel like home.</em></h1><p>Design-led heating and bathroom essentials, selected for lasting quality and delivered with expert support.</p><div class="d-flex flex-wrap gap-3 mt-4"><button class="primary btn btn-lg" (click)="scrollProducts()">Shop the collection →</button><button class="btn btn-outline-light btn-lg px-4" (click)="category='Bathrooms';load();scrollProducts()">Explore bathrooms</button></div><div class="hero-proof mt-5"><span><strong>4.8</strong> ★★★★★</span><span><strong>25k+</strong> happy homes</span><span><strong>20 yr</strong> guarantees</span></div></div>
    <div class="hero-card card border-0 shadow-lg"><span>Up to</span><strong>30%</strong><span>off selected heating</span></div>
   </section>
   <section class="trust"><span>✓ 20-year guarantees</span><span>★ Rated excellent</span><span>⌾ Secure checkout</span><span>☏ Expert technical advice</span></section>
   <section class="category-showcase container-fluid px-4 px-lg-5">
    <div class="section-heading"><div><p class="eyebrow">SHOP BY SPACE</p><h2>Find your perfect finish</h2></div><button class="btn btn-link text-dark" (click)="category='';load();scrollProducts()">View all products →</button></div>
    <div class="row g-3">
     <div class="col-12 col-md-6 col-xl-3"><button class="category-tile bathrooms" (click)="category='Bathrooms';load();scrollProducts()"><span>Bathrooms</span><small>Serene spaces, beautifully made</small><b>Shop now →</b></button></div>
     <div class="col-12 col-md-6 col-xl-3"><button class="category-tile radiators" (click)="category='Designer Radiators';load();scrollProducts()"><span>Designer radiators</span><small>Warmth that makes a statement</small><b>Shop now →</b></button></div>
     <div class="col-12 col-md-6 col-xl-3"><button class="category-tile towels" (click)="category='Heated Towel Rails';load();scrollProducts()"><span>Heated towel rails</span><small>Everyday comfort, elevated</small><b>Shop now →</b></button></div>
     <div class="col-12 col-md-6 col-xl-3"><button class="category-tile plumbing" (click)="category='Plumbing';load();scrollProducts()"><span>Plumbing</span><small>Reliable details behind the design</small><b>Shop now →</b></button></div>
    </div>
   </section>
   <section class="intro" id="products"><div><p class="eyebrow">CURATED FOR YOUR HOME</p><h2>{{category || 'Products worth living with'}}</h2></div><p>Thoughtful design, dependable engineering and service that stays with you.</p></section>
   <section class="layout">
    <aside class="card border-0 shadow-sm p-4" [class.mobile-open]="showFilters()"><div class="d-flex justify-content-between align-items-center"><h3 class="h5 fw-bold mb-0">Filter products</h3><button class="btn-close d-lg-none" (click)="showFilters.set(false)" aria-label="Close filters"></button></div><label class="form-label">Maximum price <strong>{{maxPrice|currency:'GBP':'symbol':'1.0-0'}}</strong><input class="form-range" type="range" min="50" max="1500" step="50" [(ngModel)]="maxPrice"></label><label class="form-label">Availability<select class="form-select" [(ngModel)]="inStock"><option [ngValue]="false">All products</option><option [ngValue]="true">In stock</option></select></label><div class="filter-benefit"><span>✓</span><div><strong>Need help choosing?</strong><small>Our product experts are here 7 days a week.</small></div></div><button class="btn btn-link text-dark px-0 text-start" (click)="query='';category='';maxPrice=1500;inStock=false;load()">Clear all filters</button></aside>
    <div class="catalog"><div class="catalog-head align-items-center"><div class="d-flex align-items-center gap-3"><button class="btn btn-outline-dark d-lg-none" (click)="showFilters.set(true)">☷ Filters</button><span class="text-secondary">{{filtered().length}} products</span></div><select class="form-select w-auto" [(ngModel)]="sort"><option value="featured">Featured</option><option value="low">Price: low to high</option><option value="high">Price: high to low</option></select></div>
     @if(loading()){<div class="grid">@for(i of [1,2,3,4,5,6];track i){<div class="card border-0 placeholder-glow"><span class="placeholder product-placeholder"></span><div class="card-body"><span class="placeholder col-4"></span><span class="placeholder col-10 mt-3"></span><span class="placeholder col-6 mt-2"></span></div></div>}</div>}
     @else if(sorted().length===0){<div class="empty card border-0 shadow-sm"><div class="empty-icon">⌕</div><h3>No products match those filters</h3><p class="text-secondary">Try increasing your price range or clearing the filters.</p><button class="btn btn-dark" (click)="query='';category='';maxPrice=1500;inStock=false;load()">Reset filters</button></div>}
     @else{<div class="grid">@for(p of sorted();track p.id){<article class="card product-card h-100 border-0 shadow-sm">
      <div class="photo" (click)="select(p)"><img [src]="p.image" [alt]="p.name" loading="lazy"><button class="heart" [class.saved]="isSaved(p)" (click)="$event.stopPropagation();toggleWishlist(p)">♡</button>@if(p.stock<10){<span class="badge">Only {{p.stock}} left</span>}</div>
      <div class="card-body d-flex flex-column"><div class="d-flex justify-content-between"><p class="brand-name">{{p.brand}}</p><span class="delivery-tag">Fast delivery</span></div><h3 class="card-title" (click)="select(p)">{{p.name}}</h3><p class="rating">★★★★★ <span>4.8 ({{18+p.id*7}})</span></p><div class="product-meta"><span class="colour-dot" [style.background]="p.colour.toLowerCase()"></span>{{p.colour}} · {{p.finish}}</div><div class="price mt-auto">{{p.price|currency:'GBP'}} <small>inc. VAT</small></div><button class="add btn btn-dark" (click)="add(p)">Add to basket <span>→</span></button></div>
     </article>}</div>}
    </div>
   </section>
   <section class="service-banner"><div><span class="service-icon">⌂</span><h3>Room planning support</h3><p>Share your measurements and our experts will help create a confident specification.</p><button class="btn btn-outline-light">Book a free consultation</button></div><div><span class="service-icon">♙</span><h3>Trade professionals</h3><p>Unlock project pricing, dedicated account support and simplified repeat ordering.</p><button class="btn btn-outline-light">Open a trade account</button></div></section>
   <section class="channels"><p class="eyebrow">CONNECTED COMMERCE</p><h2>One catalogue. Every channel.</h2><p>Shop confidently wherever you find us. Stock and orders stay synchronised across Shopify, Google, Instagram, eBay, Etsy and more.</p><div>SHOPIFY · GOOGLE · instagram · eBay · Etsy · Pinterest</div></section>
  </main>
 }
 @if(view()==='product' && selected(); as p){<main class="product-page">
  <nav class="breadcrumb-nav" aria-label="Breadcrumb"><button (click)="view.set('shop')">Home</button><span>›</span><button (click)="chooseCategory(p.category)">{{p.category}}</button><span>›</span><span>{{p.name}}</span></nav>
  <div class="product-detail">
   <div class="product-gallery"><div class="gallery-thumbs"><button class="active"><img [src]="p.image" alt=""></button><button><img [src]="p.image" alt=""></button><button><img [src]="p.image" alt=""></button></div><div class="detail-image"><span class="image-offer">BESTSELLER</span><img [src]="p.image" [alt]="p.name"><button class="zoom">⌕ Zoom</button></div></div>
   <div class="detail-copy"><p class="brand-name">{{p.brand}} · Product code {{p.sku}}</p><h1>{{p.name}}</h1><p class="rating">★★★★★ <span>4.8 · <u>{{18+p.id*7}} verified reviews</u></span></p><div class="big-price">{{p.price|currency:'GBP'}} <small>inc. VAT</small></div><p class="payment-copy">or 3 interest-free payments. <strong>Learn more</strong></p><p>{{p.description}}</p>
    <div class="config-group"><div class="config-label"><span>Choose colour</span><strong>{{p.colour}}</strong></div><div class="swatches"><button class="swatch selected" title="Anthracite"></button><button class="swatch white" title="White"></button><button class="swatch brass" title="Brushed Brass"></button><button class="swatch chrome" title="Chrome"></button></div></div>
    <div class="config-group"><div class="config-label"><span>Choose size</span><button>View size guide</button></div><div class="size-options"><button class="selected">600 × 785mm</button><button>600 × 1010mm</button><button>1800 × 470mm</button></div></div>
    <div class="specs"><span><strong>{{p.btu||'—'}}</strong>BTU output</span><span><strong>{{p.watts||'—'}}</strong>Watts</span><span><strong>{{p.warrantyYears}} years</strong>Guarantee</span></div>
    <div class="delivery-card"><span class="delivery-icon">✓</span><div><strong>In stock — ready to dispatch</strong><small>Order today for estimated delivery in 2–3 working days</small></div></div>
    <div class="buy-row"><div class="quantity"><button (click)="decreaseQty()">−</button><span>{{productQty()}}</span><button (click)="increaseQty()">+</button></div><button class="primary flex-grow-1" (click)="addMany(p)">Add to basket · {{p.price*productQty()|currency:'GBP'}}</button></div>
    <div class="product-assurances"><span>♢<strong>20-year guarantee</strong></span><span>↩<strong>30-day returns</strong></span><span>▣<strong>Secure payments</strong></span><span>☏<strong>Expert support</strong></span></div>
    <details open><summary>Product details</summary><p>Premium construction, quality checked and supplied with fitting guidance. Finish: {{p.finish}}. Colour: {{p.colour}}. Compatible with standard UK systems.</p></details><details><summary>Full specifications</summary><p>Heat output: {{p.btu}} BTU / {{p.watts}} Watts. Warranty: {{p.warrantyYears}} years. Full technical drawings and installation documents are available after purchase.</p></details><details><summary>Delivery & returns</summary><p>Standard, bulky-item and postcode-based delivery options are calculated at checkout. Unused items can be returned within 30 days.</p></details>
   </div>
  </div>
  <div class="mobile-buy-bar"><div><small>{{p.name}}</small><strong>{{p.price|currency:'GBP'}}</strong></div><button class="primary" (click)="addMany(p)">Add to basket</button></div>
 </main>}
 @if(view()==='cart'){<main class="narrow"><button class="back" (click)="view.set('shop')">← Continue shopping</button><h1>Your basket</h1>@if(cart().length===0){<div class="empty"><h2>Your basket is ready for something beautiful.</h2><button class="primary" (click)="view.set('shop')">Explore products</button></div>}@else{@for(l of cart();track l.product.id){<div class="line"><img [src]="l.product.image"><div><p class="brand-name">{{l.product.brand}}</p><h3>{{l.product.name}}</h3><button class="link" (click)="remove(l.product)">Remove</button></div><input type="number" min="1" max="99" [(ngModel)]="l.quantity" (change)="touchCart()"><strong>{{l.product.price*l.quantity|currency:'GBP'}}</strong></div>}<div class="summary"><p><span>Subtotal</span><strong>{{subtotal()|currency:'GBP'}}</strong></p><p><span>VAT included</span><span>Calculated</span></p><p><span>Delivery</span><span>{{subtotal()>=500?'Free':'Calculated at checkout'}}</span></p><button class="primary full" (click)="beginCheckout()">Secure checkout →</button></div>}</main>}
 @if(view()==='wishlist'){<main class="narrow"><button class="back" (click)="view.set('shop')">← Back</button><h1>Your wishlist</h1>@for(p of wishlist();track p.id){<div class="line"><img [src]="p.image"><div><p class="brand-name">{{p.brand}}</p><h3>{{p.name}}</h3></div><strong>{{p.price|currency:'GBP'}}</strong><button class="add" (click)="add(p)">Add</button></div>}@empty{<div class="empty">Save products you love with the heart icon.</div>}</main>}
 @if(view()==='login'){<main class="auth"><div><p class="eyebrow">WELCOME BACK</p><h1>{{checkoutPending?'Sign in to checkout':'Your account'}}</h1><p>Access saved items, orders, quotes and delivery tracking.</p><label>Email<input [(ngModel)]="email" type="email"></label><label>Password<input [(ngModel)]="password" type="password"></label>@if(error()){<p class="error">{{error()}}</p>}<button class="primary full" (click)="login()">Sign in securely</button><p class="demo">Demo: customer@example.com / Customer123!</p></div></main>}
 @if(view()==='checkout'){<main class="checkout"><div><button class="back" (click)="view.set('cart')">← Basket</button><p class="eyebrow">SECURE CHECKOUT</p><h1>Delivery details</h1><label>Full delivery address<textarea [(ngModel)]="address" rows="4" placeholder="House number, street, town, postcode"></textarea></label><h3>Payment</h3><div class="payment">🔒 Secure payment is authorised by your configured payment provider.<br><small>No card data is stored by this application.</small></div>@if(error()){<p class="error">{{error()}}</p>}<button class="primary full" (click)="placeOrder()">Place order · {{subtotal()|currency:'GBP'}}</button></div><aside class="summary"><h3>Order summary</h3>@for(l of cart();track l.product.id){<p><span>{{l.quantity}} × {{l.product.name}}</span><strong>{{l.quantity*l.product.price|currency:'GBP'}}</strong></p>}<hr><p><strong>Total</strong><strong>{{subtotal()|currency:'GBP'}}</strong></p></aside></main>}
 @if(view()==='account'){<main class="account-page">
  <div class="account-shell">
   <aside class="profile-panel">
    <div class="profile-identity"><div class="avatar">CU<span class="online-dot"></span></div><div><span class="welcome-label">Welcome back</span><strong>Customer</strong><small>{{email}}</small></div></div>
    <nav class="account-nav" aria-label="Account sections">
     <button [class.active]="accountTab()==='overview'" (click)="accountTab.set('overview')"><span>⌂</span><div>Overview<small>Account summary</small></div><b>›</b></button>
     <button [class.active]="accountTab()==='orders'" (click)="accountTab.set('orders')"><span>▣</span><div>My orders<small>Track and manage</small></div><b>›</b></button>
     <button [class.active]="accountTab()==='wishlist'" (click)="accountTab.set('wishlist')"><span>♡</span><div>Saved items<small>{{wishlist().length}} products</small></div><b>›</b></button>
     <button [class.active]="accountTab()==='addresses'" (click)="accountTab.set('addresses')"><span>⌖</span><div>Addresses<small>Delivery details</small></div><b>›</b></button>
     <button [class.active]="accountTab()==='quotes'" (click)="accountTab.set('quotes')"><span>◇</span><div>My quotes<small>View and approve</small></div><b>›</b></button>
     @if(isAdmin()){<button (click)="loadAdmin()"><span>⚙</span><div>Administration<small>Manage the store</small></div><b>›</b></button>}
    </nav>
    <div class="profile-help"><span>?</span><div><strong>Need some help?</strong><small>Our experts are available 7 days a week.</small><button>Contact support →</button></div></div>
    <button class="signout-button" (click)="logout()">↪ Sign out</button>
   </aside>
   <section class="account-content">
    @if(accountTab()==='overview'){
     <div class="welcome-banner"><div><p class="eyebrow">MY ACCOUNT</p><h1>Good to see you, Customer.</h1><p>Manage orders, saved products and project quotes from one place.</p></div><div class="welcome-art"><span>H</span></div></div>
     <div class="account-stats">
      <button (click)="accountTab.set('orders')"><span class="stat-icon orders-icon">▣</span><div><small>Total orders</small><strong>{{orders().length}}</strong><em>View order history →</em></div></button>
      <button (click)="accountTab.set('wishlist')"><span class="stat-icon saved-icon">♡</span><div><small>Saved products</small><strong>{{wishlist().length}}</strong><em>View wishlist →</em></div></button>
      <button (click)="accountTab.set('quotes')"><span class="stat-icon quote-icon">◇</span><div><small>Active quotes</small><strong>0</strong><em>Manage quotations →</em></div></button>
     </div>
     <div class="account-section-card"><div class="section-card-head"><div><span class="section-kicker">RECENT ACTIVITY</span><h2>Latest orders</h2></div><button class="btn btn-outline-dark btn-sm" (click)="accountTab.set('orders')">View all orders</button></div>
      @for(o of orders().slice(0,3);track o.id){<div class="order modern-order"><div class="order-product-icon">▢</div><div><small>Order #{{o.id.slice(0,8)}}</small><strong>Home project order</strong></div><span>{{o.createdAt|date}}</span><strong>{{o.total|currency:'GBP'}}</strong><span class="status">{{o.status}}</span></div>}
      @empty{<div class="account-empty"><div class="empty-illustration">▢<span>✦</span></div><h3>Your first project starts here</h3><p>You haven’t placed an order yet. Explore our curated heating and bathroom collections.</p><button class="primary" (click)="view.set('shop')">Start shopping →</button></div>}
     </div>
     <div class="account-promo-grid"><div class="account-promo dark"><span>COMPLIMENTARY SERVICE</span><h3>Planning a new room?</h3><p>Get expert guidance on product selection, sizing and compatible accessories.</p><button>Book a consultation →</button></div><div class="account-promo light"><span>FOR PROFESSIONALS</span><h3>Unlock trade benefits</h3><p>Apply for project pricing, priority support and simplified repeat ordering.</p><button>Open a trade account →</button></div></div>
    }
    @if(accountTab()==='orders'){<div class="account-section-card standalone"><div class="section-card-head"><div><span class="section-kicker">ORDER HISTORY</span><h1>My orders</h1><p>Track deliveries, download invoices and arrange returns.</p></div></div>@for(o of orders();track o.id){<div class="order modern-order"><div class="order-product-icon">▢</div><div><small>Order #{{o.id.slice(0,8)}}</small><strong>Home project order</strong></div><span>{{o.createdAt|date}}</span><strong>{{o.total|currency:'GBP'}}</strong><span class="status">{{o.status}}</span></div>}@empty{<div class="account-empty"><div class="empty-illustration">▢</div><h3>No orders yet</h3><p>Your completed orders will appear here.</p><button class="primary" (click)="view.set('shop')">Browse products</button></div>}</div>}
    @if(accountTab()==='wishlist'){<div class="account-section-card standalone"><div class="section-card-head"><div><span class="section-kicker">SAVED FOR LATER</span><h1>My wishlist</h1><p>Keep your favourite products together while planning your project.</p></div><button class="btn btn-dark" (click)="view.set('wishlist')">Open full wishlist</button></div>@for(p of wishlist().slice(0,4);track p.id){<div class="saved-row"><img [src]="p.image" [alt]="p.name"><div><small>{{p.brand}}</small><strong>{{p.name}}</strong><span>{{p.price|currency:'GBP'}}</span></div><button class="btn btn-outline-dark" (click)="add(p)">Add to basket</button></div>}@empty{<div class="account-empty"><div class="empty-illustration">♡</div><h3>Nothing saved yet</h3><p>Tap the heart on any product to save it here.</p><button class="primary" (click)="view.set('shop')">Discover products</button></div>}</div>}
    @if(accountTab()==='addresses'){<div class="account-section-card standalone"><div class="section-card-head"><div><span class="section-kicker">DELIVERY DETAILS</span><h1>My addresses</h1><p>Save addresses to make future checkout faster.</p></div><button class="btn btn-dark">+ Add address</button></div><div class="address-empty"><span>⌖</span><div><h3>No saved addresses</h3><p>Add your home, project or business delivery address.</p></div></div></div>}
    @if(accountTab()==='quotes'){<div class="account-section-card standalone"><div class="section-card-head"><div><span class="section-kicker">PROJECT PRICING</span><h1>My quotes</h1><p>Review, approve and pay personalised project quotations.</p></div><button class="btn btn-dark">Request a quote</button></div><div class="account-empty"><div class="empty-illustration">◇</div><h3>No active quotes</h3><p>Need pricing for a larger project? Our trade team can prepare a tailored quote.</p><button class="primary">Speak to our quote team</button></div></div>}
   </section>
  </div>
 </main>}
 @if(view()==='admin'){<main class="narrow"><button class="back" (click)="view.set('account')">← Account</button><p class="eyebrow">ADMINISTRATION</p><h1>Commerce overview</h1><div class="metrics"><div><span>Products</span><strong>{{admin()?.products}}</strong></div><div><span>Orders</span><strong>{{admin()?.orders}}</strong></div><div><span>Low stock</span><strong>{{admin()?.lowStock}}</strong></div><div><span>Revenue</span><strong>{{admin()?.revenue|currency:'GBP'}}</strong></div></div><section class="admin-list"><h2>Operations</h2><div>Product catalogue <button>Manage</button></div><div>Orders & fulfilment <button>Manage</button></div><div>Quotes & payment links <button>Manage</button></div><div>Sales channels <button>Connect</button></div></section></main>}
 @if(view()==='shop'){<nav class="mobile-bottom-nav" aria-label="Mobile navigation"><button class="active" (click)="view.set('shop')"><span>⌂</span>Home</button><button (click)="focusSearch()"><span>⌕</span>Search</button><button (click)="view.set('wishlist')"><span>♡</span>Saved<sup>{{wishlist().length}}</sup></button><button (click)="view.set('cart')"><span>▢</span>Basket<sup>{{cartCount()}}</sup></button><button (click)="openAccount()"><span>♙</span>Account</button></nav>}
 <a class="chat" href="https://wa.me/" aria-label="Chat on WhatsApp">◉</a>
 <footer><div class="brand"><span class="mark">H</span> HEARTH & HOME</div><p>Heating, plumbing and bathrooms — beautifully considered.</p><div><a>Delivery & returns</a><a>Privacy</a><a>Terms</a><a>Contact</a></div><small>© 2026 Hearth & Home. Secure commerce.</small></footer>
 `,
})
class App {
 private http=inject(HttpClient); products=signal<Product[]>([]); categories=signal<string[]>([]); cart=signal<Line[]>(this.read('cart',[])); wishlist=signal<Product[]>(this.read('wishlist',[])); selected=signal<Product|null>(null); view=signal('shop'); loading=signal(true);showFilters=signal(false);megaMenu=signal(false);productQty=signal(1);accountTab=signal<'overview'|'orders'|'wishlist'|'addresses'|'quotes'>('overview');query='';category='';maxPrice=1500;inStock=false;sort='featured';email=localStorage.getItem('email')||'customer@example.com';password='';address='';checkoutPending=false;error=signal('');orders=signal<Order[]>([]);isAdmin=signal(false);admin=signal<any>(null);
 filtered=computed(()=>this.products().filter(p=>p.price<=this.maxPrice&&(!this.inStock||p.stock>0)));
 sorted=computed(()=>[...this.filtered()].sort((a,b)=>this.sort==='low'?a.price-b.price:this.sort==='high'?b.price-a.price:0));
 subtotal=computed(()=>this.cart().reduce((s,l)=>s+l.product.price*l.quantity,0)); cartCount=computed(()=>this.cart().reduce((s,l)=>s+l.quantity,0));
 constructor(){this.load();this.http.get<string[]>('/api/categories').subscribe(v=>this.categories.set(v));if(this.password)this.loadAccount()}
 read<T>(key:string,fallback:T):T{try{return JSON.parse(localStorage.getItem(key)||'') as T}catch{return fallback}}
 save(key:string,value:unknown){localStorage.setItem(key,JSON.stringify(value))}
 load(){this.loading.set(true);this.http.get<Product[]>('/api/products',{params:{q:this.query,category:this.category}}).subscribe({next:v=>{this.products.set(v);this.loading.set(false);this.showFilters.set(false)},error:()=>this.loading.set(false)})}
 scrollProducts(){document.getElementById('products')?.scrollIntoView({behavior:'smooth'})}
 focusSearch(){document.querySelector<HTMLInputElement>('.search input')?.focus();scrollTo({top:0,behavior:'smooth'})}
 chooseCategory(category:string){this.category=category;this.megaMenu.set(false);this.view.set('shop');this.load();setTimeout(()=>this.scrollProducts(),0)}
 decreaseQty(){this.productQty.update(v=>Math.max(1,v-1))}
 increaseQty(){this.productQty.update(v=>Math.min(10,v+1))}
 select(p:Product){this.selected.set(p);this.productQty.set(1);this.megaMenu.set(false);this.view.set('product');scrollTo(0,0)}
 add(p:Product){const found=this.cart().find(l=>l.product.id===p.id);if(found)found.quantity++;else this.cart.update(v=>[...v,{product:p,quantity:1}]);this.touchCart();this.view.set('cart');scrollTo(0,0)}
 addMany(p:Product){const found=this.cart().find(l=>l.product.id===p.id);if(found)found.quantity+=this.productQty();else this.cart.update(v=>[...v,{product:p,quantity:this.productQty()}]);this.touchCart();this.view.set('cart');scrollTo(0,0)}
 remove(p:Product){this.cart.update(v=>v.filter(l=>l.product.id!==p.id));this.touchCart()}
 touchCart(){this.cart.set([...this.cart()]);this.save('cart',this.cart())}
 isSaved(p:Product){return this.wishlist().some(x=>x.id===p.id)}
 toggleWishlist(p:Product){this.wishlist.update(v=>this.isSaved(p)?v.filter(x=>x.id!==p.id):[...v,p]);this.save('wishlist',this.wishlist())}
 headers(){return new HttpHeaders({Authorization:'Basic '+btoa(`${this.email}:${this.password}`)})}
 openAccount(){sessionStorage.getItem('auth')?this.loadAccount():(this.view.set('login'),this.checkoutPending=false)}
 login(){this.error.set('');this.http.get<any>('/api/me',{headers:this.headers()}).subscribe({next:v=>{sessionStorage.setItem('auth',btoa(`${this.email}:${this.password}`));localStorage.setItem('email',this.email);this.isAdmin.set(v.admin);this.checkoutPending?this.view.set('checkout'):this.loadAccount()},error:()=>this.error.set('Email or password is incorrect.')})}
 authHeaders(){const token=sessionStorage.getItem('auth');return new HttpHeaders({Authorization:'Basic '+token})}
 beginCheckout(){if(!sessionStorage.getItem('auth')){this.checkoutPending=true;this.view.set('login')}else this.view.set('checkout')}
 placeOrder(){if(!this.address.trim()){this.error.set('Please enter a delivery address.');return}this.http.post<Order>('/api/orders',{items:this.cart().map(l=>({productId:l.product.id,quantity:l.quantity})),shippingAddress:this.address},{headers:this.authHeaders()}).subscribe({next:()=>{this.cart.set([]);this.touchCart();this.loadAccount()},error:()=>this.error.set('We could not place this order. Please review your details.')})}
 loadAccount(){this.http.get<any>('/api/me',{headers:this.authHeaders()}).subscribe({next:m=>{this.email=m.email;this.isAdmin.set(m.admin);this.http.get<Order[]>('/api/orders',{headers:this.authHeaders()}).subscribe(o=>this.orders.set(o));this.view.set('account')},error:()=>this.logout()})}
 loadAdmin(){this.http.get<any>('/api/admin/summary',{headers:this.authHeaders()}).subscribe(v=>{this.admin.set(v);this.view.set('admin')})}
 logout(){sessionStorage.removeItem('auth');localStorage.removeItem('email');this.password='';this.view.set('shop')}
}
bootstrapApplication(App,{providers:[provideHttpClient()]}).catch(console.error);
