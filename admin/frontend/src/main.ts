import {CommonModule,CurrencyPipe,DatePipe} from '@angular/common';
import {HttpClient,provideHttpClient,withInterceptors} from '@angular/common/http';
import {Component,computed,ElementRef,HostListener,inject,signal,ViewChild} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {bootstrapApplication, DomSanitizer, SafeHtml} from '@angular/platform-browser';
import {catchError,finalize,forkJoin,of,throwError} from 'rxjs';

type View='dashboard'|'products'|'customers'|'quotes'|'orders'|'promotions'|'inventory'|'inquiries'|'reviews'|'content'|'blogs'|'reports'|'audit'|'companies'|'banners'|'navigation';
interface AdminBlogPost{id?:number;slug:string;title:string;excerpt:string;content:string;coverImage:string;category:string;tags:string;author:string;publishedAt:string;status:string;readTimeMinutes?:number;syncStatus?:string;lastSyncedAt?:string}
interface ProductVariant{id?:number;ean:string;variantSku:string;configCode?:string;colour:string;baseColour:string;colourCode:string;paintType:string;heightMm?:number;widthMm?:number;depthMm?:number;panel:string;priceMinor:number;costMinor?:number;discountPercent?:number;stock:number;availability:string;productionTime:string;leadTime:string;watts?:number;btu?:number;warrantyYears?:number;imageUrl?:string;imageUrlsJson?:string;unlimitedStock?:boolean}
interface Product{id?:number;sku:string;name:string;brand:string;category:string;description:string;priceMinor:number;costMinor?:number;stock:number;lowStockThreshold:number;discountPercent?:number;status:string;taxClass:string;shippingClass:string;imageUrl?:string;sourceUrl?:string;updatedAt?:string;syncStatus?:string;syncError?:string;lastSyncedAt?:string;variants:ProductVariant[];availability?:string;leadTime?:string;unlimitedStock?:boolean;staticContentId?:number;staticContentSlug?:string;documentsJson?:string}
interface User{name:string;email:string;role:string}

const authInterceptor=(req:any,next:any)=>{
  const token=sessionStorage.getItem('hearth_admin_token');
  const headers:Record<string,string>={'X-Portal':'admin'};
  if(token){headers['Authorization']=`Bearer ${token}`;}
  const authReq=req.clone({setHeaders:headers});
  return next(authReq).pipe(
    catchError((error:any)=>{
      if(error?.status===429){
        const retryAfter=error.headers?.get('Retry-After')||'60';
        window.dispatchEvent(new CustomEvent('admin-rate-limit',{detail:{retryAfter:Number(retryAfter)||60}}));
      }
      return throwError(()=>error);
    })
  );
};

@Component({selector:'app-root',standalone:true,imports:[CommonModule,FormsModule,CurrencyPipe,DatePipe],template:`
<svg class="icon-sprite" aria-hidden="true"><defs>
 <symbol id="nav-dashboard" viewBox="0 0 24 24"><path d="M3 11.5 12 4l9 7.5V21h-6v-6H9v6H3z"/></symbol>
 <symbol id="nav-products" viewBox="0 0 24 24"><path d="m4 7 8-4 8 4-8 4zM4 7v10l8 4 8-4V7M12 11v10"/></symbol>
 <symbol id="nav-customers" viewBox="0 0 24 24"><circle cx="9" cy="8" r="3"/><path d="M3.5 20v-2.5A4.5 4.5 0 0 1 8 13h2a4.5 4.5 0 0 1 4.5 4.5V20M15 5.5a3 3 0 0 1 0 5.8M17 13.5a4.5 4.5 0 0 1 3.5 4.4V20"/></symbol>
 <symbol id="nav-quotes" viewBox="0 0 24 24"><path d="M6 3h9l4 4v14H6zM15 3v5h4M9 12h7M9 16h7"/></symbol>
 <symbol id="nav-orders" viewBox="0 0 24 24"><path d="M5 8h14l-1 13H6zM9 10V7a3 3 0 0 1 6 0v3"/></symbol>
 <symbol id="nav-promotions" viewBox="0 0 24 24"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><circle cx="7" cy="7" r="1.5"/></symbol>
 <symbol id="nav-inventory" viewBox="0 0 24 24"><path d="m4 7 8-4 8 4-8 4zM4 7v5l8 4 8-4V7M4 12v5l8 4 8-4v-5"/></symbol>
 <symbol id="nav-inquiries" viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></symbol>
 <symbol id="nav-reviews" viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></symbol>
 <symbol id="nav-content" viewBox="0 0 24 24"><path d="M5 3h14v18H5zM9 8h6M9 12h6M9 16h4"/></symbol>
 <symbol id="nav-banners" viewBox="0 0 24 24"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2zm0 4h16V6H4v2zm0 10h16V10H4v8z"/></symbol>
 <symbol id="nav-reports" viewBox="0 0 24 24"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></symbol>
 <symbol id="nav-audit" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2M5.5 5.5 3 3"/></symbol>
 <symbol id="nav-blogs" viewBox="0 0 24 24"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/><line x1="8" y1="6" x2="16" y2="6"/><line x1="8" y1="10" x2="16" y2="10"/></symbol>
 <symbol id="nav-logout" viewBox="0 0 24 24"><path d="M10 5H5v14h5M14 8l4 4-4 4M18 12H9"/></symbol>
</defs></svg>
@if(!user()){
 <main class="login-page"><section class="login-story"><div class="brand"><img src="/thp-logo.jpg" alt="THP" style="height:38px;width:auto;border-radius:4px;background:#fff;padding:2px 8px"><div>THP<small>HEATING & PLUMBING</small></div></div><div><p class="eyebrow">SECURE CONTROL CENTRE</p><h1>Run every order.<br><em>Know every detail.</em></h1><p>Catalogue, customers, quotations, stock and fulfilment — one clear operational workspace.</p></div><div class="trust"><span>◈ Role-protected</span><span>◎ Fully auditable</span><span>↗ Built to scale</span></div></section>
 <section class="login-panel"><form (ngSubmit)="login()"><div class="mobile-brand brand"><img src="/thp-logo.jpg" alt="THP" style="height:38px;width:auto;border-radius:4px;background:#fff;padding:2px 8px"><div>THP<small>ADMIN CONSOLE</small></div></div><p class="eyebrow">WELCOME BACK</p><h2>Sign in to your workspace</h2><p class="muted">Use your administrator credentials to continue.</p><label>Email address<input name="email" type="email" autocomplete="username" [(ngModel)]="email" required></label><label>Password<div class="password"><input name="password" [type]="showPassword?'text':'password'" autocomplete="current-password" [(ngModel)]="password" required><button type="button" (click)="showPassword=!showPassword">{{showPassword?'Hide':'Show'}}</button></div></label>@if(error()){<div class="alert">{{error()}}</div>}<button class="primary login-button" [disabled]="loading()">{{loading()?'Signing in…':'Sign in securely'}} <span>→</span></button></form></section></main>
}@else{
 <div class="app-shell" [class.nav-open]="navOpen()"><aside><div class="brand side-brand"><img src="/thp-logo.jpg" alt="THP" style="height:36px;width:auto;border-radius:4px;background:#fff;padding:2px 8px"><div>THP<small>ADMIN CONSOLE</small></div></div><nav aria-label="Admin navigation">@for(group of nav;track group.label){<p>{{group.label}}</p>@for(item of group.items;track item.view){<button [class.active]="view()===item.view" (click)="go(item.view)"><svg class="nav-icon" aria-hidden="true"><use [attr.href]="'#'+item.icon"></use></svg><span>{{item.name}}</span>@if(item.badge){<b>{{item.badge}}</b>}</button>}}</nav></aside>
 <section class="workspace"><header><button class="menu" (click)="navOpen.set(!navOpen())">☰</button><div class="header-search-wrap"><div class="header-search"><button class="search-submit" title="Search" (click)="searchAll()">⌕</button><input #globalSearchInput placeholder="Search products, orders or customers" [(ngModel)]="globalSearch" (input)="queueGlobalSearch()" (focus)="searchOpen.set(true)" (keyup.enter)="searchAll()"><button class="search-clear" title="Clear search" [class.visible]="globalSearch" (click)="clearGlobalSearch()">×</button><kbd (click)="focusGlobalSearch()">⌘ K</kbd></div>@if(searchOpen()&&globalSearch.trim()){<div class="header-popover search-popover"><div class="popover-title"><span>Search results</span><small>{{searching()?'Searching…':searchResults().length+' found'}}</small></div>@if(!searching()&&!searchResults().length){<div class="popover-empty">No matching products, customers, orders or quotations.</div>}@for(result of searchResults();track result.type+result.title){<button class="search-result" (click)="openSearchResult(result)"><i>{{result.icon}}</i><span><strong>{{result.title}}</strong><small>{{result.subtitle}}</small></span><b>{{result.type}} →</b></button>}<div class="search-hint">Press Enter to open the first result</div></div>}</div><div class="header-actions"><div class="header-control"><button class="icon-button" title="Notifications" [attr.aria-expanded]="notificationsOpen()" (click)="toggleNotifications()">♢@if(unreadNotifications()){<b></b>}</button>@if(notificationsOpen()){<div class="header-popover notifications-popover"><div class="popover-title"><span>Notifications</span><button (click)="markNotificationsRead()">Mark all read</button></div><button (click)="openNotification('inventory')"><i class="coral">!</i><span><strong>Low stock alert</strong><small>{{dashboardData()?.lowStock||0}} products are below their threshold</small></span></button><button (click)="openNotification('orders')"><i class="red">×</i><span><strong>Payment exceptions</strong><small>{{dashboardData()?.paymentExceptions||0}} orders need attention</small></span></button><button (click)="openNotification('quotes')"><i class="gold">◷</i><span><strong>Quotation follow-up</strong><small>{{dashboardData()?.openQuotes||0}} active quotations</small></span></button></div>}</div><div class="header-control"><button class="profile" [attr.aria-expanded]="profileOpen()" (click)="toggleProfile()"><span>{{initials()}}</span><span class="profile-copy"><strong>{{user()!.name}}</strong><small>{{roleLabel()}}</small></span><i>{{profileOpen()?'⌃':'⌄'}}</i></button>@if(profileOpen()){<div class="header-popover profile-popover"><div class="profile-summary"><span>{{initials()}}</span><div><strong>{{user()!.name}}</strong><small>{{user()!.email}}</small></div></div><button (click)="goFromProfile('dashboard')"><svg class="profile-menu-icon" aria-hidden="true"><use href="#nav-dashboard"></use></svg>Dashboard</button><button (click)="goFromProfile('audit')"><svg class="profile-menu-icon" aria-hidden="true"><use href="#nav-audit"></use></svg>View audit activity</button><hr><button class="danger-action" (click)="logout()"><svg class="profile-menu-icon" aria-hidden="true"><use href="#nav-logout"></use></svg>Sign out</button></div>}</div></div></header>
 <main class="content">
  @if(view()==='dashboard'){<ng-container *ngTemplateOutlet="dashboard"></ng-container>}
  @if(view()==='products'){<ng-container *ngTemplateOutlet="productsView"></ng-container>}
  @if(view()==='customers'){<ng-container *ngTemplateOutlet="customersView"></ng-container>}
  @if(view()==='quotes'){<ng-container *ngTemplateOutlet="quotesView"></ng-container>}
  @if(view()==='orders'){<ng-container *ngTemplateOutlet="ordersView"></ng-container>}
  @if(view()==='promotions'){<ng-container *ngTemplateOutlet="promotionsView"></ng-container>}
  @if(view()==='inventory'){<ng-container *ngTemplateOutlet="inventoryView"></ng-container>}
  @if(view()==='inquiries'){<ng-container *ngTemplateOutlet="inquiriesView"></ng-container>}
  @if(view()==='reviews'){<ng-container *ngTemplateOutlet="reviewsView"></ng-container>}
  @if(view()==='content'){<ng-container *ngTemplateOutlet="contentView"></ng-container>}
  @if(view()==='blogs'){<ng-container *ngTemplateOutlet="blogsView"></ng-container>}
  @if(view()==='banners'){<ng-container *ngTemplateOutlet="bannersView"></ng-container>}
  @if(view()==='reports'){<ng-container *ngTemplateOutlet="reportsView"></ng-container>}
  @if(view()==='audit'){<ng-container *ngTemplateOutlet="auditView"></ng-container>}
   @if(view()==='companies'){<ng-container *ngTemplateOutlet="companiesView"></ng-container>}
  @if(view()==='navigation'){<ng-container *ngTemplateOutlet="navigationView"></ng-container>}
 </main></section></div>
}

<ng-template #dashboard><div class="page-head"><div><p class="eyebrow">MONDAY, 3 AUGUST</p><h1>Good morning, {{firstName()}}</h1><p>Here’s what needs your attention across the business today.</p></div><div class="head-actions"><button class="secondary">⇩ Export report</button><button class="primary" (click)="newProduct()">＋ Add product</button></div></div>
@if(loading()){<div class="skeleton metrics"><i></i><i></i><i></i><i></i></div>}@else{<section class="metrics"><article><div><span class="metric-icon green">↗</span><small>Net sales</small></div><strong>{{dashboardData()?.revenueMinor/100|currency:'GBP'}}</strong><p class="up">↑ 12.4% <span>vs last period</span></p></article><article><div><span class="metric-icon blue">▣</span><small>Orders</small></div><strong>{{dashboardData()?.orders}}</strong><p class="up">↑ 8.2% <span>vs last period</span></p></article><article><div><span class="metric-icon gold">♙</span><small>Customers</small></div><strong>{{dashboardData()?.customers}}</strong><p><span>{{dashboardData()?.openQuotes}} open quotations</span></p></article><article><div><span class="metric-icon coral">!</span><small>Needs attention</small></div><strong>{{dashboardData()?.lowStock+dashboardData()?.paymentExceptions}}</strong><p class="warn">Low stock & payment issues</p></article></section>}
<section class="dashboard-grid"><article class="panel chart-panel"><div class="panel-head"><div><h2>Sales overview</h2><p>Net sales across all channels</p></div><select><option>Last 7 days</option><option>Last 30 days</option></select></div><div class="chart"><div class="chart-y"><span>£8k</span><span>£6k</span><span>£4k</span><span>£2k</span><span>£0</span></div><svg viewBox="0 0 700 230" preserveAspectRatio="none"><defs><linearGradient id="fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#346f62" stop-opacity=".3"/><stop offset="1" stop-color="#346f62" stop-opacity="0"/></linearGradient></defs><path class="area" d="M0 188 C60 170,80 196,145 145 S235 162,292 108 S390 129,440 82 S540 112,590 55 S650 73,700 35 L700 230 L0 230Z"/><path class="line" d="M0 188 C60 170,80 196,145 145 S235 162,292 108 S390 129,440 82 S540 112,590 55 S650 73,700 35"/></svg><div class="chart-x"><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span><span>Sun</span></div></div></article><article class="panel attention"><div class="panel-head"><div><h2>Needs attention</h2><p>Operational exceptions</p></div><button>View all</button></div><button (click)="go('inventory')"><span class="attention-icon coral">!</span><div><strong>Low stock products</strong><small>{{dashboardData()?.lowStock}} products below threshold</small></div><b>→</b></button><button (click)="go('orders')"><span class="attention-icon red">×</span><div><strong>Payment failures</strong><small>{{dashboardData()?.paymentExceptions}} orders need review</small></div><b>→</b></button><button (click)="go('quotes')"><span class="attention-icon gold">◷</span><div><strong>Expiring quotations</strong><small>{{dashboardData()?.openQuotes}} active quotations</small></div><b>→</b></button></article></section>
<section class="dashboard-grid lower"><article class="panel"><div class="panel-head"><div><h2>Recent orders</h2><p>Latest activity from all channels</p></div><button (click)="go('orders')">View all orders →</button></div><div class="table-wrap"><table><thead><tr><th>Order</th><th>Customer</th><th>Status</th><th>Payment</th><th>Total</th></tr></thead><tbody>@for(o of dashboardData()?.recentOrders||[];track o.id){<tr><td><strong>{{o.orderNumber}}</strong></td><td>{{o.customerName}}</td><td><span class="status" [attr.data-status]="o.orderStatus">{{pretty(o.orderStatus)}}</span></td><td><span class="status" [attr.data-status]="o.paymentStatus">{{pretty(o.paymentStatus)}}</span></td><td><strong>{{o.totalMinor/100|currency:'GBP'}}</strong></td></tr>}</tbody></table></div></article><article class="panel quick"><div class="panel-head"><div><h2>Quick actions</h2><p>Common operational tasks</p></div></div><div><button (click)="newProduct()"><i>＋</i><span><strong>New product</strong><small>Add to catalogue</small></span></button><button (click)="newCustomer()"><i>♙</i><span><strong>New customer</strong><small>Create an account</small></span></button><button (click)="newQuote()"><i>▤</i><span><strong>New quotation</strong><small>Build an estimate</small></span></button><button (click)="go('companies')"><i>🏭</i><span><strong>Brands & Companies</strong><small>Manage catalogue</small></span></button></div></article></section></ng-template>

<ng-template #productsView><div class="page-head"><div><p class="eyebrow">CATALOGUE</p><h1>Products</h1><p>Manage product data, pricing, publication and stock.</p>@if(imageCoverage()){<span class="image-coverage">▧ {{imageCoverage().variantImages}} of {{imageCoverage().variants}} variant images matched</span>}</div><div class="head-actions product-head-actions"><button class="secondary sync-all-btn" type="button" [disabled]="syncingAll()" (click)="syncAllToStorefront()"><span [class.spin]="syncingAll()">⚡</span> {{syncingAll()?'Syncing storefront…':'Sync All to Storefront'}}</button><button class="secondary" type="button" (click)="openBulkProductsModal()">📦 Bulk Products</button><button class="secondary" type="button" (click)="openMediaManager()">🖼 Bulk Images & Media</button><a class="secondary" href="/api/products/export-csv" target="_blank" download style="text-decoration:none;display:inline-flex;align-items:center;gap:4px">⇩ Export Products (CSV)</a><button class="primary" (click)="newProduct()">＋ Add product</button></div></div><div class="toolbar" style="display:flex;gap:10px;align-items:center;flex-wrap:wrap"><label style="flex:1;min-width:240px">⌕<input placeholder="Search name, SKU, variant SKU, brand or category" [(ngModel)]="query" (keyup.enter)="applyProductFilters()"></label><select [(ngModel)]="productBrand" (change)="applyProductFilters()" style="min-width:180px"><option value="">All Companies / Brands</option>@for(b of (companyList().length?companyList():brands());track b.name||b.brand){<option [value]="b.name||b.brand">{{b.name||b.brand}}</option>}</select><select [(ngModel)]="productStatus" (change)="applyProductFilters()" style="min-width:140px"><option value="">All statuses</option><option value="PUBLISHED">Active (Published)</option><option value="DRAFT">Deactive (Draft)</option></select><button class="secondary" (click)="applyProductFilters()">Apply filters</button></div><section class="panel list-panel">@if(loading()){<div class="loading-state">Loading catalogue…</div>}@else if(!products().length){<div class="empty-state"><span>▧</span><h3>No products found</h3><p>Adjust the filters or create your first product.</p><button class="primary" (click)="newProduct()">Add product</button></div>}@else{<div class="table-wrap"><table><thead><tr><th>Product</th><th>SKU</th><th>Brand</th><th>Category</th><th>Price</th><th>Stock</th><th>Variants</th><th>Sync</th><th>Status & Publication</th><th>Actions</th></tr></thead><tbody>@for(p of products();track p.id){<tr class="clickable-product-row" tabindex="0" [attr.aria-label]="'View details for '+p.name" (click)="viewProduct(p)" (keydown.enter)="viewProduct(p)" (keydown.space)="$event.preventDefault();viewProduct(p)"><td><button type="button" class="product-link image-only" [attr.aria-label]="'View '+p.name" (click)="$event.stopPropagation();viewProduct(p)"><span class="product-cell">@if(p.imageUrl){<img [src]="p.imageUrl" [alt]="p.name" loading="lazy" referrerpolicy="no-referrer">}@else{<span>{{p.name.charAt(0)}}</span>}</span></button></td><td><code>{{p.sku}}</code></td><td><span class="badge" style="background:#f1f5f9;color:#334155;font-weight:600">{{p.brand||'—'}}</span></td><td>{{p.category}}</td><td><strong>{{p.priceMinor/100|currency:'GBP'}}</strong></td><td>@if(p.unlimitedStock){<span class="badge" style="background:#ecfdf5;color:#15803d;font-weight:700">Unlimited</span>}@else{<span [class.low]="p.stock<=p.lowStockThreshold">{{p.stock}} units</span>}</td><td><strong>{{p.variants.length||0}}</strong></td><td><span class="status" [attr.data-status]="p.syncStatus">{{pretty(p.syncStatus||"PENDING")}}</span></td><td (click)="$event.stopPropagation()">@if(p.status==='PUBLISHED'){<button type="button" class="sync-row-btn" style="background:#dcfce7;color:#15803d;border:1px solid #86efac;font-weight:700;padding:5px 10px;cursor:pointer" (click)="toggleProductStatus(p,$event)" title="Active on Storefront. Click to Deactivate (Draft)">● Active (Deactivate)</button>}@else{<button type="button" class="delete-btn" style="background:#fee2e2;color:#b91c1c;border:1px solid #fca5a5;font-weight:700;padding:5px 10px;cursor:pointer" (click)="toggleProductStatus(p,$event)" title="Deactive. Click to Publish on Storefront">○ Deactive (Activate)</button>}</td><td (click)="$event.stopPropagation()"><div class="row-actions"><button class="sync-row-btn" [disabled]="syncingProductId()===p.id" (click)="syncSingleProduct(p,$event)" title="Re-sync to storefront"><span [class.spin]="syncingProductId()===p.id">⚡</span> Sync</button><button class="more" (click)="editProduct(p)" title="Edit product details">Edit</button><button class="delete-btn" (click)="deleteProduct(p,$event)" title="Delete product">🗑 Delete</button></div></td></tr>}</tbody></table></div><div class="pagination-bar"><p>Showing <strong>{{productRangeStart()}}–{{productRangeEnd()}}</strong> of <strong>{{productTotalElements()}}</strong> products</p><nav class="pagination-controls" aria-label="Product pagination"><button (click)="previousProductPage()" [disabled]="productPage()===0||loading()" aria-label="Previous page">←</button>@for(page of productPages();track page){<button (click)="goToProductPage(page)" [class.active]="productPage()===page" [disabled]="loading()" [attr.aria-current]="productPage()===page?'page':null">{{page+1}}</button>}<button (click)="nextProductPage()" [disabled]="productPage()>=productTotalPages()-1||loading()" aria-label="Next page">→</button></nav></div>}</section></ng-template>

<ng-template #customersView><div class="page-head"><div><p class="eyebrow">RELATIONSHIPS</p><h1>Customers</h1><p>Customer profiles, consent, value and account status.</p></div><button class="primary" (click)="newCustomer()">＋ Add customer</button></div><div class="toolbar"><label>⌕<input placeholder="Search name or email" [(ngModel)]="query" (keyup.enter)="loadCustomers()"></label><button class="secondary" (click)="loadCustomers()">Search</button></div><section class="panel list-panel"><div class="table-wrap"><table><thead><tr><th>Customer</th><th>Contact</th><th>Location</th><th>Lifetime value</th><th>Status</th><th>Actions</th></tr></thead><tbody>@for(c of customers();track c.id){<tr><td><div class="customer-cell"><span>{{customerInitials(c.name)}}</span><strong>{{c.name}}</strong></div></td><td>{{c.email}}<small>{{c.phone}}</small></td><td>{{c.city||'—'}}</td><td><strong>{{c.lifetimeValueMinor/100|currency:'GBP'}}</strong><small>{{c.orderCount||0}} orders</small></td><td><span class="status" [attr.data-status]="c.status">{{pretty(c.status)}}</span></td><td><button [class]="c.status==='ACTIVE'?'delete-btn':'sync-row-btn'" (click)="toggleCustomerStatus(c)" [title]="c.status==='ACTIVE'?'Deactivate customer login & access':'Reactivate customer account'">{{c.status==='ACTIVE'?'⛔ Deactivate':'✓ Activate'}}</button></td></tr>}</tbody></table></div></section></ng-template>

<ng-template #quotesView><div class="page-head"><div><p class="eyebrow">SALES</p><h1>Quotations</h1><p>Prepare, send and track customer estimates.</p></div><button class="primary" (click)="newQuote()">＋ New quotation</button></div><section class="metrics slim"><article><small>Active value</small><strong>{{quoteValue()/100|currency:'GBP'}}</strong></article><article><small>Sent & viewed</small><strong>{{quotes().length}}</strong></article><article><small>Conversion rate</small><strong>42%</strong></article></section><section class="panel list-panel"><div class="table-wrap"><table><thead><tr><th>Quotation #</th><th>Customer & Delivery Address</th><th>Valid Until</th><th>Status</th><th>Total (incl. 20% VAT)</th><th>Actions</th></tr></thead><tbody>@for(q of quotes();track q.id){<tr><td><strong>{{q.quoteNumber}}</strong><small>{{q.createdAt|date:'shortDate'}}</small></td><td><strong>{{q.customerName}}</strong><small>{{q.customerEmail}}</small>@if(q.customerAddress){<small class="muted" style="max-width:200px;overflow:hidden;text-overflow:ellipsis;display:block">📍 {{q.customerAddress}}</small>}</td><td>{{q.expiresOn|date:'mediumDate'}}</td><td><span class="status" [attr.data-status]="q.status">{{pretty(q.status)}}</span></td><td><strong>{{q.totalMinor/100|currency:'GBP'}}</strong></td><td><div style="display:flex;gap:6px"><button class="sync-row-btn" (click)="viewQuoteDetails(q)">👁 View Quote</button><button class="sync-row-btn" [disabled]="sendingQuoteEmail()" (click)="sendQuoteEmail(q)" title="Email quotation">✉ Email</button><button class="sync-row-btn" (click)="editQuote(q)" title="Edit Quotation">✏ Edit</button><button class="delete-btn" (click)="deleteQuote(q)">🗑</button></div></td></tr>}</tbody></table></div></section></ng-template>

<ng-template #ordersView><div class="page-head"><div><p class="eyebrow">COMMERCE</p><h1>Orders & fulfilment</h1><p>Track payments, courier dispatch, and live delivery status.</p></div><button class="primary" (click)="loadOrders()">↻ Refresh Orders</button></div><section class="panel list-panel"><div class="table-wrap"><table><thead><tr><th>Order</th><th>Channel</th><th>Customer</th><th>Order status</th><th>Fulfilment</th><th>Courier & Tracking</th><th>Total</th><th>Actions</th></tr></thead><tbody>@for(o of orders();track o.id){<tr><td><strong>{{o.orderNumber}}</strong><small>{{o.createdAt|date:'short'}}</small></td><td><span class="badge" [class.green]="o.channel==='STOREFRONT'" [class.blue]="o.channel!=='STOREFRONT'">{{o.channel||'STOREFRONT'}}</span></td><td><strong>{{o.customerName}}</strong><small>{{o.customerEmail}}</small><small *ngIf="o.customerPhone">📞 {{o.customerPhone}}</small></td><td><span class="status" [attr.data-status]="o.orderStatus">{{pretty(o.orderStatus)}}</span></td><td><span class="status" [attr.data-status]="o.fulfilmentStatus">{{pretty(o.fulfilmentStatus||'UNFULFILLED')}}</span></td><td>@if(o.trackingNumber){<strong>{{o.carrier||'DPD Express'}}</strong><small><code>{{o.trackingNumber}}</code></small>}@else{<span class="muted small">Awaiting Dispatch</span>}</td><td><strong>{{o.totalMinor/100|currency:'GBP'}}</strong><small *ngIf="o.discountCode" class="text-success">{{o.discountCode}}</small></td><td><div style="display:flex;gap:6px"><button class="more" (click)="openDispatchModal(o)">Dispatch / Edit</button><button class="sync-row-btn" (click)="openSendOrderModal(o)" title="Send fulfilment & tracking update to customer">✉ Send to Customer</button></div></td></tr>}</tbody></table></div></section></ng-template>

<ng-template #promotionsView><div class="page-head"><div><p class="eyebrow">MARKETING & REVENUE</p><h1>Discounts & Coupons</h1><p>Manage promo codes, basket rules, and live storefront sync.</p></div><div class="head-actions"><button class="secondary" (click)="syncAllPromotions()">⚡ Sync to Storefront</button><button class="primary" (click)="newPromotion()">＋ Add coupon</button></div></div><section class="panel list-panel">@if(!promotions().length){<div class="empty-state"><span>🏷</span><h3>No promotions configured</h3><p>Create your first promotional discount or coupon code.</p></div>}@else{<div class="table-wrap"><table><thead><tr><th>Code</th><th>Label</th><th>Discount</th><th>Min Spend</th><th>Status</th><th>Actions</th></tr></thead><tbody>@for(p of promotions();track p.id){<tr><td><strong><code>{{p.code}}</code></strong></td><td>{{p.label}}</td><td>@if(p.discountType==='FREE_SHIPPING'){<span class="badge blue">Free UK Delivery</span>}@else if(p.discountType==='PERCENT'){<strong>{{p.discountValue}}% OFF</strong>}@else{<strong>{{p.discountValue|currency:'GBP'}} OFF</strong>}</td><td>{{p.minBasketMinor?(p.minBasketMinor/100|currency:'GBP'):'No min.'}}</td><td><span class="status" [attr.data-status]="p.active?'PUBLISHED':'DRAFT'">{{p.active?'ACTIVE':'PAUSED'}}</span></td><td><button class="more" (click)="editPromotion(p)">Edit</button><button class="sync-row-btn" (click)="togglePromotionActive(p)">{{p.active?'Pause':'Activate'}}</button></td></tr>}</tbody></table></div>}</section></ng-template>

<ng-template #inquiriesView><div class="page-head"><div><p class="eyebrow">CUSTOMER CARE & PRODUCT CLAIMS</p><h1>Support & Technical Inquiries</h1><p>Customer inquiries, complaints, and claim tickets with automatic order purchase verification.</p></div><button class="primary" (click)="loadInquiries()">↻ Refresh</button></div><div class="toolbar" style="display:flex;gap:12px;align-items:center;flex-wrap:wrap"><label style="flex:1;max-width:380px">⌕<input placeholder="Search ticket #, customer, order #, or defect..." [(ngModel)]="inquirySearch"></label><select [(ngModel)]="inquiryFilter" (change)="loadInquiries()" style="min-width:180px"><option value="">All inquiries</option><option value="PENDING">Pending attention</option><option value="CONTACTED">In progress</option><option value="RESOLVED">Resolved</option><option value="REJECTED">Rejected</option><option value="UNVERIFIED">⚠️ Unverified Orders Only</option></select></div><section class="panel list-panel">@if(!filteredInquiries().length){<div class="empty-state"><span>💬</span><h3>No support inquiries found</h3><p>Adjust your search filters or wait for customer claim submissions.</p></div>}@else{<div class="table-wrap"><table class="inquiries-table"><thead><tr><th class="col-ticket">Ticket & Date</th><th class="col-customer">Customer</th><th class="col-contact">Contact</th><th class="col-topic">Topic & Order Verification</th><th class="col-msg">Question / Claim</th><th class="col-attach">Evidence</th><th class="col-status">Status</th><th class="col-actions">Actions</th></tr></thead><tbody>@for(inq of filteredInquiries();track inq.id){<tr><td class="col-ticket"><strong>#{{inq.ticketNumber || ('TKT-' + inq.id)}}</strong><small class="d-block muted">{{inq.createdAt|date:'short'}}</small></td><td class="col-customer"><strong>{{inq.name || inq.customerName || 'Customer'}}</strong></td><td class="col-contact"><div><small>{{inq.email || inq.customerEmail}}</small></div><div *ngIf="inq.phone || inq.customerPhone"><a [href]="'tel:'+(inq.phone||inq.customerPhone)">📞 {{inq.phone || inq.customerPhone}}</a></div></td><td class="col-topic"><span class="badge">{{inq.category||'General'}}</span>@if(inq.orderVerified){<div class="order-badge verified" title="Genuine verified purchase: Order found in database!"><span style="color:#16a34a">✓</span> Verified Order: #{{inq.orderNumber}}</div>}@else if(inq.hasOrderNumber && !inq.orderVerified){<div class="order-badge unverified" title="Order NOT found in database. Unverified purchase!"><span style="color:#dc2626">⚠️</span> Unverified Order: #{{inq.orderNumber}}</div>}@else{<div class="order-badge none"><small class="muted">No Order Ref</small></div>}@if(inq.productName){<div style="margin-top:2px"><small class="muted">📦 {{inq.productName}}</small></div>}</td><td class="col-msg"><p style="margin:0;font-size:.84rem;line-height:1.45">{{inq.message}}</p>@if(inq.resolutionNotes){<small [class.text-danger]="inq.status==='REJECTED'" [class.text-success]="inq.status==='RESOLVED'" class="d-block" style="margin-top:6px;font-size:0.75rem"><strong>{{inq.status==='REJECTED'?'✕ Rejection Note:':'✓ Staff Note:'}}</strong> {{inq.resolutionNotes}}</small>}</td><td class="col-attach">@if(inq.attachmentUrl){@if(isImage(inq.attachmentUrl)){<a [href]="inq.attachmentUrl" target="_blank" style="text-decoration:none;display:inline-block"><img [src]="inq.attachmentUrl" alt="Evidence" (error)="onThumbError($event)" style="width:44px;height:44px;object-fit:cover;border-radius:4px;border:1px solid #cbd5e1;display:block;margin:auto"><small style="font-size:0.72rem;color:var(--primary,#0284c7)">🔍 Photo</small></a>}@else{<a [href]="inq.attachmentUrl" target="_blank" class="mini-btn secondary-mini" style="text-decoration:none;font-size:0.75rem">📎 PDF</a>}}@else{<span class="muted small">—</span>}</td><td class="col-status"><span class="status" [attr.data-status]="inq.status">{{pretty(inq.status)}}</span></td><td class="col-actions"><div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap"><button class="primary-mini mini-btn" (click)="openInquiryModal(inq)">🔍 Details</button>@if(inq.status!=='RESOLVED'){<button class="resolve-btn" (click)="updateInquiryStatus(inq,'RESOLVED')">✓ Resolve</button>}@if(inq.status!=='REJECTED'){<button class="reject-btn" (click)="quickRejectInquiry(inq)">✕ Reject</button>}<button class="sync-row-btn" (click)="openSendInquiryModal(inq)" title="Send response email directly to customer">✉ Send to Customer</button></div></td></tr>}</tbody></table></div>}</section></ng-template>


<ng-template #reviewsView><div class="page-head"><div><p class="eyebrow">MODERATION & TRUST</p><h1>Customer Reviews & Ratings</h1><p>Moderate customer ratings, manage genuine testimonials, and publish verified reviews live to the storefront.</p></div><div class="head-actions" style="display:flex;gap:8px"><button class="secondary" (click)="loadAdminReviews()">↻ Refresh</button><button class="primary" (click)="newReview()">＋ Add Review</button></div></div><div class="toolbar" style="display:flex;gap:12px;align-items:center"><select [(ngModel)]="reviewFilter" (change)="loadAdminReviews()" style="min-width:180px"><option value="">All reviews</option><option value="PENDING_APPROVAL">Pending Approval</option><option value="APPROVED">Approved & Published</option><option value="REJECTED">Rejected</option></select></div><section class="panel list-panel">@if(!reviews().length){<div class="empty-state"><span>★</span><h3>No customer reviews found</h3><p>Customer ratings and reviews will appear here for moderation, or you can add new reviews manually.</p><button class="primary" (click)="newReview()">Add Customer Review</button></div>}@else{<div class="table-wrap"><table><thead><tr><th>Date</th><th>Customer</th><th>Product / SKU</th><th>Rating</th><th>Review Headline & Comment</th><th>Status</th><th style="text-align:right">Actions</th></tr></thead><tbody>@for(rev of reviews();track rev.id){<tr><td><small>{{rev.createdAt|date:'short'}}</small></td><td><strong>{{rev.author}}</strong><div *ngIf="rev.authorEmail"><small class="muted">{{rev.authorEmail}}</small></div><small class="badge" style="background:#f1f5f9;margin-top:3px;display:inline-block">{{rev.role||'Verified Homeowner'}}</small></td><td><span class="badge" style="background:#eff6ff;color:#1d4ed8">{{rev.category||'Radiators'}}</span><div *ngIf="rev.productSku"><small><code>{{rev.productSku}}</code></small></div></td><td><strong style="color:#eab308;font-size:1.05rem;letter-spacing:1px">{{'★'.repeat(rev.rating||5)}}{{'☆'.repeat(5-(rev.rating||5))}}</strong><div style="font-size:0.75rem;color:#64748b;font-weight:700">{{rev.rating||5}} / 5 Stars</div></td><td style="max-width:320px"><strong *ngIf="rev.title" style="display:block;margin-bottom:3px;font-size:0.9rem">{{rev.title}}</strong><p style="margin:0;font-size:0.84rem;line-height:1.45;color:#334155">{{rev.comment}}</p></td><td><span class="status" [attr.data-status]="rev.status">{{pretty(rev.status)}}</span></td><td style="text-align:right"><div style="display:inline-flex;gap:4px">@if(rev.status!=='APPROVED'){<button type="button" class="sync-row-btn" (click)="approveAdminReview(rev)" title="Approve & Publish to Storefront">✓ Approve</button>}@if(rev.status!=='REJECTED'){<button type="button" class="delete-btn" (click)="rejectAdminReview(rev)" title="Reject Review">✕ Reject</button>}<button type="button" class="sync-row-btn" (click)="editReview(rev)" title="Edit Review">✏ Edit</button><button type="button" class="delete-btn" (click)="deleteAdminReview(rev)" title="Delete Review">🗑</button></div></td></tr>}</tbody></table></div>}</section></ng-template>

<ng-template #inventoryView><div class="page-head"><div><p class="eyebrow">FULFILMENT</p><h1>Inventory & Stock Positions</h1><p>Live stock positions, low-stock alerts, and immutable movement history synced with Storefront.</p></div><div style="display:flex;gap:8px"><button class="secondary" (click)="loadProducts();loadInventory();loadAllProductsForAssignment()">↻ Refresh</button><span class="badge green" style="padding:8px 12px">✓ Stock Positions Live</span></div></div><div class="toolbar" style="margin-bottom:18px;display:flex;gap:12px;align-items:center"><label style="flex:1;max-width:380px"><input type="search" [(ngModel)]="inventorySearch" placeholder="Search inventory by product name or SKU..."></label><label class="checkbox-inline" style="margin:0"><input type="checkbox" [(ngModel)]="onlyLowStock"><span>Only show low stock (≤ threshold)</span></label></div><section class="dashboard-grid"><article class="panel"><div class="panel-head"><div><h2>Stock position ({{filteredInventoryProducts().length}} items)</h2><p>Available inventory by product with direct adjustment</p></div></div><div style="max-height:540px;overflow-y:auto">@if(!filteredInventoryProducts().length){<div class="empty-mini">No matching products found.</div>}@for(p of filteredInventoryProducts();track p.id){<div class="stock-row" style="grid-template-columns:minmax(170px,1.2fr) 1fr 45px auto;align-items:center;gap:12px"><div><strong>{{p.name}}</strong><small>{{p.sku}} · Main Warehouse</small></div><div class="stock-bar"><i [style.width.%]="stockPercent(p.stock)"></i></div><b [class.low]="p.stock<=p.lowStockThreshold" [title]="p.stock<=p.lowStockThreshold?'Low stock warning! Threshold: '+p.lowStockThreshold:''">{{p.stock}}</b><button type="button" class="mini-btn primary-mini" (click)="openStock(p.id)" title="Adjust stock for this product">↕ Adjust</button></div>}</div></article><article class="panel"><div class="panel-head"><div><h2>Movement ledger ({{inventory().length}} transactions)</h2><p>Latest stock receipts, dispatches, and manual adjustments</p></div></div><div style="max-height:540px;overflow-y:auto">@if(!inventory().length){<div class="empty-mini">No adjustments recorded yet.</div>}@for(t of inventory();track t.id){<div class="activity" style="padding:12px 18px"><span [class.negative]="t.quantityChange<0">{{t.quantityChange>0?'+':''}}{{t.quantityChange}}</span><div><strong>{{t.productName}}</strong><small>{{t.reason}} · {{t.warehouse}} · <code>{{t.sku}}</code></small><small class="muted" *ngIf="t.beforeQuantity!==undefined">Stock: {{t.beforeQuantity}} → <strong>{{t.afterQuantity}}</strong></small></div><time>{{t.createdAt|date:'short'}}</time></div>}</div></article></section></ng-template>

<ng-template #contentView><div class="page-head"><div><p class="eyebrow">STOREFRONT CRM</p><h1>CRM & Legal Policy Pages</h1><p>Manage Terms & Conditions, Privacy Policy, FAQs, and static storefront content with live store sync.</p></div><div style="display:flex;gap:8px"><button class="secondary" (click)="loadContent()">↻ Refresh</button><button class="primary" (click)="newContent()">＋ Create Page</button></div></div><section class="panel list-panel"><div class="table-wrap"><table><thead><tr><th>Title & Slug</th><th>Type</th><th>PDF Attachment</th><th>Updated</th><th>Status</th><th style="text-align:right">Actions</th></tr></thead><tbody>@for(c of contents();track c.id){<tr><td><strong>{{c.title}}</strong><div><small class="muted"><code>/{{c.slug}}</code></small></div><small *ngIf="c.seoTitle" class="muted">{{c.seoTitle}}</small></td><td><span class="badge">{{pretty(c.type)}}</span></td><td>@if(c.pdfFilename){<div style="display:flex;align-items:center;gap:6px"><span style="font-size:1.1rem">📄</span><a [href]="c.pdfUrl" target="_blank" style="font-weight:700;color:var(--green);text-decoration:none;font-size:0.75rem" title="Open attached PDF in new tab">{{c.pdfFilename}}</a></div>}@else{<span class="muted small">—</span>}</td><td>{{c.updatedAt|date:'mediumDate'}}</td><td><button type="button" class="sync-row-btn" [style.background]="c.status==='PUBLISHED'?'#dcfce7':'#f3f4f6'" [style.color]="c.status==='PUBLISHED'?'#166534':'#4b5563'" [style.border]="c.status==='PUBLISHED'?'1px solid #86efac':'1px solid #d1d5db'" (click)="toggleContentStatus(c)" title="Click to toggle status">{{pretty(c.status)}}</button></td><td style="text-align:right"><div style="display:inline-flex;gap:4px"><button type="button" class="sync-row-btn" (click)="previewCmsHtml(c)" title="Live HTML Preview" style="background:#f0fdf4;color:#166534;border-color:#bbf7d0">👁 View HTML</button><button type="button" class="sync-row-btn" (click)="editContent(c)" title="Edit Page">✏ Edit</button><button type="button" class="more" (click)="deleteContent(c)" title="Delete Page" style="color:#dc2626">🗑 Delete</button></div></td></tr>}</tbody></table></div></section><section class="panel" style="margin-top:24px;padding:24px"><div class="panel-head" style="margin-bottom:16px;display:flex;justify-content:space-between;align-items:center"><div><p class="eyebrow" style="color:#e8760d;font-weight:700">STOREFRONT SOCIAL CHANNELS</p><h2 style="font-size:1.25rem;margin:0 0 6px">Brand Social Media Links</h2><p style="color:#64748b;font-size:0.85rem;margin:0">Configure official social links displayed in the storefront header and footer.</p></div><button type="button" class="primary" [disabled]="savingSocial()" (click)="saveSocialLinks()">{{savingSocial() ? 'Saving…' : '💾 Save Social Links'}}</button></div><div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(280px, 1fr));gap:16px"><label><span style="font-weight:600;font-size:0.82rem;display:block;margin-bottom:4px">Facebook Page URL</span><input type="url" [(ngModel)]="socialLinks.facebook" placeholder="https://www.facebook.com/..." style="width:100%"></label><label><span style="font-weight:600;font-size:0.82rem;display:block;margin-bottom:4px">Instagram Profile URL</span><input type="url" [(ngModel)]="socialLinks.instagram" placeholder="https://www.instagram.com/..." style="width:100%"></label><label><span style="font-weight:600;font-size:0.82rem;display:block;margin-bottom:4px">TikTok Profile URL</span><input type="url" [(ngModel)]="socialLinks.tiktok" placeholder="https://www.tiktok.com/@..." style="width:100%"></label><label><span style="font-weight:600;font-size:0.82rem;display:block;margin-bottom:4px">X (Twitter) URL</span><input type="url" [(ngModel)]="socialLinks.x" placeholder="https://x.com/..." style="width:100%"></label><label><span style="font-weight:600;font-size:0.82rem;display:block;margin-bottom:4px">Pinterest URL</span><input type="url" [(ngModel)]="socialLinks.pinterest" placeholder="https://pinterest.com/..." style="width:100%"></label></div></section></ng-template>

<ng-template #blogsView><div class="page-head"><div><p class="eyebrow">CONTENT & ADVICE MARKETING</p><h1>Blog & Advice Articles</h1><p>Manage Heat & Plumb buying guides, heating advice tutorials, and sync articles live to Storefront.</p></div><div class="head-actions" style="display:flex;gap:8px"><button class="secondary sync-all-btn" type="button" [disabled]="syncingAllBlogs()" (click)="syncAllBlogsToStorefront()"><span [class.spin]="syncingAllBlogs()">⚡</span> {{syncingAllBlogs()?'Syncing Blogs…':'Sync All to Storefront'}}</button><button class="secondary" (click)="loadBlogs()">↻ Refresh</button><button class="primary" (click)="newBlog()">＋ New Article</button></div></div><div class="toolbar" style="display:flex;gap:12px;align-items:center;flex-wrap:wrap"><label style="flex:1;max-width:380px">⌕<input placeholder="Search article title, category or tags..." [(ngModel)]="blogSearchQuery"></label><select [(ngModel)]="blogCategoryFilter" style="min-width:180px"><option value="">All categories</option>@for(cat of adminBlogCategories();track cat){<option [value]="cat">{{cat}}</option>}</select><select [(ngModel)]="blogStatusFilter" style="min-width:140px"><option value="">All statuses</option><option value="PUBLISHED">Published</option><option value="DRAFT">Draft</option></select></div><section class="panel list-panel">@if(loadingBlogs()){<div class="loading-state">Loading blog articles…</div>}@else if(!filteredAdminBlogs().length){<div class="empty-state"><span>📖</span><h3>No blog articles found</h3><p>Create a new article or sync from Heat & Plumb scraped archive.</p><button class="primary" (click)="newBlog()">Add Article</button></div>}@else{<div class="table-wrap"><table><thead><tr><th>Cover</th><th>Article Title & Slug</th><th>Category & Tags</th><th>Author & Date</th><th>Read Time</th><th>Status</th><th style="text-align:right">Actions</th></tr></thead><tbody>@for(b of filteredAdminBlogs();track b.id||b.slug){<tr><td>@if(b.coverImage){<img [src]="b.coverImage" [alt]="b.title" style="width:54px;height:40px;object-fit:cover;border-radius:4px;border:1px solid #cbd5e1;display:block">}@else{<span style="display:inline-block;width:54px;height:40px;background:#f1f5f9;border-radius:4px;text-align:center;line-height:40px;color:#94a3b8">📄</span>}</td><td style="max-width:320px"><strong style="display:block;font-size:0.92rem">{{b.title}}</strong><small class="muted"><code>/blog/{{b.slug}}</code></small></td><td><span class="badge" style="background:#fff2ec;color:#ef6722;border:1px solid #fed7aa;font-weight:700">{{b.category}}</span>@if(b.tags){<div style="margin-top:4px"><small class="muted" style="font-size:0.72rem">{{b.tags}}</small></div>}</td><td><strong>{{b.author}}</strong><div class="muted small">{{b.publishedAt}}</div></td><td><span class="badge">{{b.readTimeMinutes||5}} min</span></td><td><button type="button" class="status-badge-btn" [attr.data-status]="b.status" (click)="toggleBlogStatus(b)">{{pretty(b.status)}}</button></td><td style="text-align:right"><div style="display:inline-flex;gap:4px"><button type="button" class="sync-row-btn" (click)="editBlog(b)" title="Edit Article">✏ Edit</button><button type="button" class="more" (click)="deleteBlog(b)" title="Delete Article" style="color:#dc2626">🗑 Delete</button></div></td></tr>}</tbody></table></div>}</section></ng-template>

<ng-template #bannersView><div class="page-head"><div><p class="eyebrow">STOREFRONT MARKETING · HERO & CAMPAIGNS</p><h1>Banners & Campaigns</h1><p>Manage dynamic sliding hero banners and secondary campaign cards (dual banners) with live image configuration and instant storefront sync.</p></div><div class="head-actions" style="display:flex;gap:8px"><button class="secondary sync-all-btn" type="button" [disabled]="syncingBanners()" (click)="syncAllBannersToStorefront()"><span [class.spin]="syncingBanners()">⚡</span> {{syncingBanners()?'Syncing Banners…':'Sync All to Storefront'}}</button><button class="secondary" (click)="loadBanners()">↻ Refresh</button><button class="secondary" (click)="newBanner('CAMPAIGN_BANNER')">＋ Add Second Banner</button><button class="primary" (click)="newBanner('BANNER')">＋ Add Hero Banner</button></div></div><div class="toolbar" style="display:flex;gap:10px;align-items:center;margin-bottom:14px;flex-wrap:wrap"><label style="margin:0;font-size:0.86rem;font-weight:600">Filter Section:</label><div style="display:inline-flex;gap:6px"><button type="button" class="tab-btn" [class.active]="bannerSectionFilter==='ALL'" (click)="setBannerFilter('ALL')" style="padding:6px 12px;font-size:0.82rem">All Banners ({{banners().length}})</button><button type="button" class="tab-btn" [class.active]="bannerSectionFilter==='BANNER'" (click)="setBannerFilter('BANNER')" style="padding:6px 12px;font-size:0.82rem">Hero Slider (Top)</button><button type="button" class="tab-btn" [class.active]="bannerSectionFilter==='CAMPAIGN_BANNER'" (click)="setBannerFilter('CAMPAIGN_BANNER')" style="padding:6px 12px;font-size:0.82rem">Second Banners (Campaigns)</button></div></div><section class="panel list-panel">@if(loadingBanners()){<div class="loading-state">Loading storefront banners…</div>}@else if(!filteredBanners().length){<div class="empty-state"><span>🖼</span><h3>No banners found in this section</h3><p>Create your hero slider or second campaign banner to showcase featured products and seasonal promotions.</p><div style="display:flex;gap:8px;justify-content:center"><button class="primary" (click)="newBanner('BANNER')">Add Hero Banner</button><button class="secondary" (click)="newBanner('CAMPAIGN_BANNER')">Add Second Banner</button></div></div>}@else{<div class="table-wrap"><table><thead><tr><th style="width:50px">Order</th><th style="width:80px">Visual</th><th>Placement</th><th>Eyebrow Tag</th><th>Banner Headline & Description</th><th>Button & Target Link</th><th>Status</th><th style="text-align:right">Actions</th></tr></thead><tbody>@for(b of filteredBanners();track b.id){<tr><td><span class="badge blue">#{{b.sortOrder||1}}</span></td><td>@if(b.imageUrl){<img [src]="b.imageUrl" [alt]="b.title" style="width:68px;height:44px;object-fit:cover;border-radius:4px;border:1px solid #cbd5e1;display:block">}@else{<span style="display:inline-block;width:68px;height:44px;background:#f1f5f9;border-radius:4px;text-align:center;line-height:44px;color:#94a3b8;font-size:1.2rem">🖼</span>}</td><td>@if((b.type||'BANNER')==='CAMPAIGN_BANNER'){<span class="badge" style="background:#ede9fe;color:#6b21a8;border:1px solid #ddd6fe;font-weight:700">Second Banner</span>}@else{<span class="badge blue">Top Hero</span>}</td><td><span class="badge" style="background:#fff2ec;color:#ef6722;border:1px solid #fed7aa;font-weight:700">{{b.tag || '✦ SPECIAL FEATURE'}}</span></td><td style="max-width:320px"><strong style="display:block;font-size:0.94rem;color:#0f172a">{{b.title}}</strong><small class="muted" style="line-height:1.4;display:block;margin-top:2px">{{b.body}}</small></td><td><strong style="font-size:0.86rem;display:block">{{b.buttonText || 'Explore Catalogue'}}</strong><small class="muted"><code>{{b.linkUrl || '#new-arrivals'}}</code></small></td><td><button type="button" class="status-badge-btn" [attr.data-status]="b.status" (click)="toggleBannerStatus(b)">{{pretty(b.status)}}</button></td><td style="text-align:right"><div style="display:inline-flex;gap:6px"><button type="button" class="sync-row-btn" (click)="editBanner(b)" title="Edit Banner">✏ Edit</button><button type="button" class="more" (click)="deleteBanner(b)" title="Delete Banner" style="color:#dc2626">🗑 Delete</button></div></td></tr>}</tbody></table></div>}</section></ng-template>

<ng-template #reportsView><div class="page-head"><div><p class="eyebrow">OPERATIONAL INSIGHTS & ANALYTICS</p><h1>Reports & Financial Performance</h1><p>Sales summaries, channels, average order values, and inventory valuation.</p></div><div class="head-actions"><button class="primary" (click)="downloadReportCsv()">⇩ Export Report (CSV)</button></div></div><section class="metrics"><article><div><span class="metric-icon green">£</span><small>Gross Catalogue Revenue</small></div><strong>{{(dashboardData()?.revenueMinor||0)/100|currency:'GBP'}}</strong><p class="up">↑ Across Storefront & B2B Estimates</p></article><article><div><span class="metric-icon blue">📦</span><small>Total Orders Placed</small></div><strong>{{dashboardData()?.orders||orders().length}}</strong><p>Storefront online transactions</p></article><article><div><span class="metric-icon gold">▤</span><small>Formal Estimates (Quotes)</small></div><strong>{{quotes().length}}</strong><p>B2B & trade quotations</p></article><article><div><span class="metric-icon coral">⚠️</span><small>Operational Exceptions</small></div><strong>{{(dashboardData()?.lowStock||0)+(dashboardData()?.paymentExceptions||0)}}</strong><p class="warn">Low stock & pending queries</p></article></section><section class="dashboard-grid"><article class="panel"><div class="panel-head"><div><h2>Sales Channels & Fulfilment Summary</h2><p>Storefront direct orders vs custom trade estimates</p></div></div><div class="table-wrap"><table><thead><tr><th>Channel</th><th>Orders / Quotes</th><th>Conversion</th><th>VAT Status</th><th>Gross Total</th></tr></thead><tbody><tr><td><strong>Storefront Online (Shopify)</strong></td><td>{{orders().length}} orders</td><td><span class="badge green">100% Paid</span></td><td>Standard 20% Included</td><td><strong>{{(dashboardData()?.revenueMinor||0)/100|currency:'GBP'}}</strong></td></tr><tr><td><strong>B2B Trade & Project Estimates</strong></td><td>{{quotes().length}} quotes</td><td><span class="badge blue">Active</span></td><td>20% Fixed Trade VAT</td><td><strong>{{quoteValue()/100|currency:'GBP'}}</strong></td></tr></tbody></table></div></article><article class="panel"><div class="panel-head"><div><h2>Category Distribution</h2><p>Top performing heating categories</p></div></div><div class="table-wrap"><table><thead><tr><th>Category</th><th>Est. Demand</th><th>Status</th></tr></thead><tbody><tr><td><strong>Designer Radiators</strong></td><td>46%</td><td><span class="badge green">High Volume</span></td></tr><tr><td><strong>Towel Radiators & Rails</strong></td><td>24%</td><td><span class="badge green">In Stock</span></td></tr><tr><td><strong>Underfloor Heating Kits</strong></td><td>18%</td><td><span class="badge blue">Fast Moving</span></td></tr><tr><td><strong>Plumbing Valves & Accessories</strong></td><td>12%</td><td><span class="badge">Standard</span></td></tr></tbody></table></div></article></section></ng-template>

<ng-template #companiesView><div class="page-head"><div><p class="eyebrow">CATALOGUE MANAGEMENT</p><h1>Brands & Companies</h1><p>Manage product brands, logos, manufacturer specifications, and bulk activate / deactivate products across the storefront.</p></div><div class="head-actions" style="display:flex;gap:8px"><button class="secondary" (click)="loadCompanies()">↻ Refresh</button><button class="primary" (click)="newCompany()">＋ Add Brand / Company</button></div></div><section class="panel list-panel">@if(loadingCompanies()){<div class="loading-state">Loading brands & companies…</div>}@else if(!companyList().length && !brands().length){<div class="empty-state"><span>🏭</span><h3>No brands or companies found</h3><p>Create manufacturer brands to organize heating catalogue and allow 1-click brand activation.</p><button class="primary" (click)="newCompany()">Add Brand / Company</button></div>}@else{<div class="table-wrap"><table><thead><tr><th style="width:70px">Logo</th><th>Brand / Company Name</th><th>Code</th><th>Contact & Website</th><th>Storefront Status</th><th>Products Linked</th><th style="text-align:right">Actions</th></tr></thead><tbody>@for(c of companyList();track c.id||c.code){<tr><td>@if(c.logoUrl){<img [src]="c.logoUrl" [alt]="c.name" style="width:54px;height:36px;object-fit:contain;background:#fff;border-radius:4px;border:1px solid #cbd5e1;padding:2px">}@else{<span style="display:inline-block;width:54px;height:36px;background:#f1f5f9;border-radius:4px;text-align:center;line-height:36px;font-size:1.1rem">🏭</span>}</td><td><strong style="font-size:0.92rem;display:block">{{c.name}}</strong>@if(c.description){<small class="muted" style="max-width:240px;overflow:hidden;text-overflow:ellipsis;display:block">{{c.description}}</small>}</td><td><code>{{c.code}}</code></td><td>@if(c.website){<a [href]="c.website" target="_blank" style="display:block;font-size:0.78rem;color:#0284c7;text-decoration:none">{{c.website}}</a>}@if(c.contactEmail){<small class="muted" style="display:block">✉ {{c.contactEmail}}</small>}@if(c.contactPhone){<small class="muted" style="display:block">☎ {{c.contactPhone}}</small>}</td><td><button type="button" class="status-badge-btn" [attr.data-status]="c.status" (click)="toggleCompanyStatus(c)" [title]="'Click to toggle status (currently '+c.status+')'">{{c.status}}</button></td><td><div style="display:flex;gap:4px"><button type="button" class="sync-row-btn" style="font-size:0.68rem;padding:4px 8px" (click)="toggleBrandProductsStatus(c.name, true)" title="Publish all products of this brand">✓ Bulk Activate</button><button type="button" class="delete-btn" style="font-size:0.68rem;padding:4px 8px" (click)="toggleBrandProductsStatus(c.name, false)" title="Unpublish all products of this brand">⛔ Bulk Deactivate</button></div></td><td style="text-align:right"><div style="display:inline-flex;gap:4px"><button type="button" class="sync-row-btn" (click)="editCompany(c)">✏ Edit</button><button type="button" class="delete-btn" (click)="deleteCompany(c)">🗑 Delete</button></div></td></tr>}</tbody></table></div>}</section></ng-template>

<ng-template #auditView><div class="page-head"><div><p class="eyebrow">GOVERNANCE</p><h1>Audit log</h1><p>Immutable history of sensitive administrative activity.</p></div><button class="secondary" (click)="refreshAudit()">↻ Refresh</button></div><section class="panel audit-table-panel">@if(loading()){<div class="loading-state">Loading audit activity…</div>}@else if(!audits().length){<div class="empty-state"><span>◎</span><h3>No audit activity yet</h3><p>Login, logout, product and inventory activity will appear here.</p></div>}@else{<div class="table-wrap"><table class="audit-table"><thead><tr><th>Date & time</th><th>Actor</th><th>Action</th><th>Entity</th><th>Details</th><th>IP address</th></tr></thead><tbody>@for(a of audits();track a.id){<tr><td><time>{{a.createdAt|date:'medium'}}</time></td><td><div class="audit-actor"><span>{{(a.actor||'S').charAt(0).toUpperCase()}}</span><strong>{{a.actor||'system'}}</strong></div></td><td><span class="audit-action" [attr.data-action]="a.action">{{pretty(a.action)}}</span></td><td><strong>{{pretty(a.entityType)}}</strong><small>{{auditEntityName(a)}}</small></td><td class="audit-detail">{{a.detail||'—'}}</td><td><code>{{a.ipAddress||'—'}}</code></td></tr>}</tbody></table></div><div class="pagination-bar"><p>Showing <strong>{{auditRangeStart()}}–{{auditRangeEnd()}}</strong> of <strong>{{auditTotalElements()}}</strong> audit records</p><nav class="pagination-controls" aria-label="Audit log pagination"><button (click)="previousAuditPage()" [disabled]="auditPage()===0||loading()" aria-label="Previous page">←</button>@for(page of auditPages();track page){<button (click)="goToAuditPage(page)" [class.active]="auditPage()===page" [disabled]="loading()" [attr.aria-current]="auditPage()===page?'page':null">{{page+1}}</button>}<button (click)="nextAuditPage()" [disabled]="auditPage()>=auditTotalPages()-1||loading()" aria-label="Next page">→</button></nav></div>}</section></ng-template>


<ng-template #navigationView>
  <div class="page-head">
    <div>
      <p class="eyebrow">STOREFRONT NAVIGATION · DYNAMIC MENUS & FILTERS</p>
      <h1>Navigation & Dynamic Filters</h1>
      <p>Configure storefront header menus, mega-menu dropdown columns/items, and per-menu dynamic product filter cards.</p>
    </div>
    <div class="head-actions" style="display:flex;gap:8px">
      <button class="secondary" type="button" (click)="loadNavigationMenus()">↻ Refresh</button>
      <button class="secondary" type="button" (click)="resetNavMenuDefaults()">↺ Reset to Defaults</button>
      <button class="primary" type="button" (click)="newNavMenu()">＋ Add Navigation Menu</button>
    </div>
  </div>

  <section class="panel list-panel">
    @if(loadingNavMenus()){
      <div class="loading-state">Loading storefront navigation menus…</div>
    }@else if(!navMenus().length){
      <div class="empty-state">
        <span>🧭</span>
        <h3>No navigation menus configured</h3>
        <p>Set up your primary navigation departments and custom filter options for each category.</p>
        <button class="primary" (click)="resetNavMenuDefaults()">Load Default British Heating Menus</button>
      </div>
    }@else{
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th style="width:50px">Order</th>
              <th>Menu Department</th>
              <th>Mapped Category</th>
              <th>Submenu Columns</th>
              <th>Enabled Dynamic Filters</th>
              <th>Status</th>
              <th style="text-align:right">Actions</th>
            </tr>
          </thead>
          <tbody>
            @for(m of navMenus();track m.id||m.menuId){
              <tr>
                <td><span class="badge blue">#{{m.sortOrder||1}}</span></td>
                <td>
                  <div style="display:flex;align-items:center;gap:10px">
                    @if(m.imageUrl){
                      <img [src]="m.imageUrl" [alt]="m.title" style="width:42px;height:42px;object-fit:cover;border-radius:6px;border:1px solid #cbd5e1;flex-shrink:0">
                    }@else{
                      <span style="font-size:1.3rem">{{m.icon||"📁"}}</span>
                    }
                    <div>
                      <strong style="font-size:0.95rem;display:block;color:#0f172a">{{m.title}}</strong>
                      @if(m.badge){<span class="badge" style="background:#fee2e2;color:#b91c1c;font-weight:700;font-size:0.7rem;margin-top:2px">{{m.badge}}</span>}
                    </div>
                  </div>
                </td>
                <td><code style="font-weight:600;color:#0284c7">{{m.category}}</code></td>
                <td>
                  <span class="badge" style="background:#f1f5f9;color:#334155;border:1px solid #cbd5e1">
                    {{m.columns?.length || 0}} Columns ({{countMenuLinks(m)}} links)
                  </span>
                </td>
                <td style="max-width:320px">
                  <div style="display:flex;flex-wrap:wrap;gap:4px">
                    @if(m.filterOptions?.showPriceFilter){<span class="badge green" style="font-size:0.7rem">Price</span>}
                    @if(m.filterOptions?.showAvailabilityFilter){<span class="badge green" style="font-size:0.7rem">In Stock</span>}
                    @if(m.filterOptions?.showBrandFilter){<span class="badge green" style="font-size:0.7rem">Brand</span>}
                    @if(m.filterOptions?.showColourFilter){<span class="badge green" style="font-size:0.7rem">Colours</span>}
                    @if(m.filterOptions?.showBtuFilter){<span class="badge" style="background:#fef3c7;color:#92400e;border:1px solid #fde68a;font-size:0.7rem">BTU</span>}
                    @if(m.filterOptions?.showPanelTypeFilter){<span class="badge" style="background:#ede9fe;color:#6b21a8;border:1px solid #ddd6fe;font-size:0.7rem">Panel Types</span>}
                    @if(m.filterOptions?.showHeightFilter){<span class="badge" style="background:#e0f2fe;color:#0369a1;border:1px solid #bae6fd;font-size:0.7rem">Height</span>}
                    @if(m.filterOptions?.showFuelTypeFilter){<span class="badge" style="background:#ffedd5;color:#c2410c;border:1px solid #fed7aa;font-size:0.7rem">Fuel Type</span>}
                    @if(m.filterOptions?.subcategories?.length){
                      <span class="badge" style="background:#f8fafc;color:#475569;border:1px solid #e2e8f0;font-size:0.7rem">+{{m.filterOptions.subcategories.length}} Subcategories</span>
                    }
                  </div>
                </td>
                <td>
                  <button type="button" class="status-badge-btn" [attr.data-status]="m.status" (click)="toggleNavMenuStatus(m)">
                    {{pretty(m.status)}}
                  </button>
                </td>
                <td style="text-align:right">
                  <div style="display:inline-flex;gap:6px">
                    <button type="button" class="sync-row-btn" (click)="editNavMenu(m)" title="Configure Menu & Filters">✏ Edit Menu & Filters</button>
                    <button type="button" class="more" (click)="deleteNavMenu(m)" title="Delete Menu" style="color:#dc2626">🗑 Delete</button>
                  </div>
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    }
  </section>
</ng-template>

@if(modal()){<div class="modal-backdrop"><section class="modal" [class.product-modal]="modal()!.type==='product'" [class.product-detail-modal]="modal()!.type==='product'||modal()!.type==='productDetails'||modal()!.type==='mediaManager'||modal()!.type==='bulkProducts'||modal()!.type==='inquiryDetails'||modal()!.type==='quote'||modal()!.type==='navMenu'" (click)="$event.stopPropagation()"><header><div><p class="eyebrow">{{modal()!.kicker}}</p><h2>{{modal()!.title}}</h2></div><button (click)="closeModal()">×</button></header>
 @if(modal()!.type==='productDetails'){<div class="product-detail-layout"><div class="product-detail-image">@if(productDraft.imageUrl){<img [src]="productDraft.imageUrl" [alt]="productDraft.name" referrerpolicy="no-referrer">}@else{<span>{{productDraft.name.charAt(0)}}</span>}</div><div class="product-detail-info"><div class="detail-heading"><div><small>{{productDraft.brand||'Unbranded'}}</small><h3>{{productDraft.name}}</h3></div><span class="status" [attr.data-status]="productDraft.status">{{pretty(productDraft.status)}}</span></div><dl class="detail-grid"><div><dt>SKU</dt><dd>{{productDraft.sku}}</dd></div><div><dt>Category</dt><dd>{{productDraft.category||'—'}}</dd></div><div><dt>Price</dt><dd>{{productDraft.priceMinor/100|currency:'GBP'}}</dd></div><div><dt>Discount / Price drop</dt><dd>Save {{productDraft.discountPercent!=null?productDraft.discountPercent:20}}% OFF</dd></div><div><dt>Stock</dt><dd>{{productDraft.stock}} units</dd></div><div><dt>Height (mm)</dt><dd>{{productHeightSummary(productDraft)}}</dd></div><div><dt>Width (mm)</dt><dd>{{productWidthSummary(productDraft)}}</dd></div><div><dt>Tax class</dt><dd>{{pretty(productDraft.taxClass)}}</dd></div><div><dt>Shipping</dt><dd>{{pretty(productDraft.shippingClass)}}</dd></div></dl>@if(productDraft.description){<div class="detail-description"><h4>Description</h4><p>{{productDraft.description}}</p></div>}@if(productDraft.variants && productDraft.variants.length){<div class="detail-description"><h4>Variants & Sizing ({{productDraft.variants.length}})</h4><div class="table-wrap" style="max-height:180px;overflow-y:auto"><table><thead><tr><th>SKU</th><th>Height</th><th>Width</th><th>Colour</th><th>Price</th><th>Discount</th><th>Stock</th></tr></thead><tbody>@for(v of productDraft.variants;track v.variantSku||v.ean){<tr><td><code>{{v.variantSku}}</code></td><td><strong>{{v.heightMm?v.heightMm+' mm':'—'}}</strong></td><td>{{v.widthMm?v.widthMm+' mm':'—'}}</td><td>{{v.colour||'Standard'}}</td><td>{{v.priceMinor/100|currency:'GBP'}}</td><td>{{v.discountPercent?v.discountPercent+'% OFF':'0%'}}</td><td>{{v.stock}}</td></tr>}</tbody></table></div></div>}<div class="detail-actions"><button type="button" class="secondary" (click)="openStock(productDraft.id)">↕ Adjust stock</button><button class="secondary sync-row-btn" [disabled]="syncingProductId()===productDraft.id" (click)="syncSingleProduct(productDraft)"><span [class.spin]="syncingProductId()===productDraft.id">⚡</span> Sync to Storefront</button><button class="primary" (click)="editProduct(productDraft)">Edit product</button><button type="button" class="danger-btn" (click)="deleteProduct(productDraft)">🗑 Delete product</button></div></div></div>}
 @if(modal()!.type==='product'){<form (ngSubmit)="saveProduct()" class="form-grid">@if(productDraft.imageUrl){<div class="product-edit-preview full"><img [src]="productDraft.imageUrl" [alt]="productDraft.name" referrerpolicy="no-referrer"><div><strong>Current product image</strong><small>{{selectedImageName||'Uploaded or linked product image'}}</small></div></div>}<label>Product name *<input name="name" [(ngModel)]="productDraft.name" required></label><label>SKU *<input name="sku" [(ngModel)]="productDraft.sku" required></label><label>Brand<input name="brand" [(ngModel)]="productDraft.brand"></label><label>Category<input name="category" [(ngModel)]="productDraft.category"></label><label>Price (£) *<input name="price" type="number" min="0" step=".01" [(ngModel)]="productPrice" placeholder="0.00"></label><label>Discount (% Off)<input name="discountPercent" type="number" min="0" max="90" [(ngModel)]="productDraft.discountPercent" placeholder="0 (defaults to 0%)"><small class="field-hint">Calculates Was/RRP price and badge (e.g. Save 20%)</small></label><div><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px"><span style="font-size:0.68rem;font-weight:700">Stock</span><label class="checkbox-inline" style="margin:0;font-size:0.68rem"><input type="checkbox" name="unlimitedStock" [(ngModel)]="productDraft.unlimitedStock"><span>Unlimited</span></label></div><input name="stock" type="number" min="0" [(ngModel)]="productDraft.stock" [disabled]="(productDraft.variants.length > 0) || !!productDraft.unlimitedStock" placeholder="0">@if(productDraft.variants.length){<small class="field-hint" style="color:#0284c7">Auto-calculated from {{productDraft.variants.length}} variant(s)</small>}</div><label>Availability<select name="availability" [(ngModel)]="productDraft.availability"><option value="IN_STOCK">In Stock (Ready to dispatch)</option><option value="AVAILABLE_TO_ORDER">Available to Order</option><option value="MADE_TO_ORDER">Made to Order</option><option value="BACKORDER">Backorder</option></select></label><label>Lead Time<input name="leadTime" [(ngModel)]="productDraft.leadTime" placeholder="e.g. 2-3 Working Days"></label><label>Publication Status<select name="status" [(ngModel)]="productDraft.status"><option value="PUBLISHED">PUBLISHED (Visible on Storefront)</option><option value="DRAFT">DRAFT (Admin Only / Inactive)</option></select><small class="field-hint">PUBLISHED products sync live to storefront; DRAFT products remain hidden.</small></label><label class="full">Assign Buying Guide / Sizing Spec Guide<select name="staticContentGuide" [(ngModel)]="productDraft.staticContentId" (change)="onStaticGuideSelected()"><option [ngValue]="null">-- None --</option>@for(c of contents();track c.id){<option [value]="c.id">{{c.title}} (/{{c.slug}})</option>}</select></label><div class="image-upload-field full"><span>Product primary image</span><div style="display:flex;gap:10px;align-items:center;margin-top:6px"><label class="upload-dropzone" [class.uploading]="uploadingImage()" style="flex:1;margin:0"><input type="file" accept="image/jpeg,image/png,image/gif,image/webp" (change)="uploadProductImage($event)" [disabled]="uploadingImage()"><b>{{uploadingImage()?'Uploading image…':'Choose image file'}}</b><small>JPG, PNG, GIF or WebP · maximum 5 MB</small></label><button type="button" class="secondary" (click)="openMediaPicker('product')" style="white-space:nowrap;padding:16px 14px">🖼 Pick from Media Library</button></div></div><label class="full">Or use an image URL<input name="imageUrl" type="url" [(ngModel)]="productDraft.imageUrl" placeholder="https://example.com/product.jpg"></label><div class="full" style="background:#f8fafc;border:1px solid #cbd5e1;border-radius:8px;padding:16px;margin-top:6px"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px"><div><strong style="font-size:0.92rem;color:#0f172a">Product Technical Documents & Specifications</strong><small class="d-block text-muted" style="font-size:0.76rem">Attach PDF spec sheets, installation manuals, dimensional drawings, or warranty guides.</small></div><button type="button" class="secondary" (click)="addDocToProduct()" style="font-size:0.78rem;padding:6px 12px">＋ Add Document</button></div>@for(doc of productDocuments;track $index;let dIdx=$index){<div style="display:grid;grid-template-columns:1.5fr 2fr auto auto;gap:8px;align-items:center;margin-bottom:8px;padding:8px;background:#fff;border:1px solid #e2e8f0;border-radius:6px"><input [(ngModel)]="doc.title" [name]="'doc_title_'+dIdx" placeholder="Document Title (e.g. Installation Guide)" style="font-size:0.82rem;padding:6px 10px"><input [(ngModel)]="doc.url" [name]="'doc_url_'+dIdx" placeholder="PDF URL (/api/content/files/... or https://...)" style="font-size:0.82rem;padding:6px 10px"><label class="secondary" style="margin:0;padding:6px 10px;font-size:0.78rem;cursor:pointer;white-space:nowrap" [class.uploading]="uploadingDoc()"><input type="file" accept=".pdf,application/pdf" (change)="uploadDocFile($event, doc)" style="display:none" [disabled]="uploadingDoc()"><span>{{uploadingDoc()?'Uploading…':'📁 Upload PDF'}}</span></label><button type="button" class="delete-btn" (click)="removeDocFromProduct(dIdx)" style="padding:6px 10px;margin:0" title="Remove Document">✕</button></div>}@empty{<p class="muted" style="margin:0;font-size:0.82rem;font-style:italic">No documents attached yet. Click "＋ Add Document" to attach technical spec sheets or manuals.</p>}</div><section class="variant-editor full">
  <div class="variant-head">
    <div>
      <strong style="font-size:1.02rem;color:#0f172a">Product Variants & Sizing Matrix</strong>
      <small style="color:#64748b;font-size:0.78rem">Configure size variations, heat outputs, barcodes, and pricing. Main stock is auto-calculated from variant quantities.</small>
    </div>
    <button type="button" class="primary" (click)="addVariant()" style="font-size:0.8rem;padding:8px 16px">＋ Add Variant</button>
  </div>
  @for(v of productDraft.variants;track $index;let vIdx=$index){
    <div class="variant-card">
      <div class="variant-card-header">
        <div class="variant-card-title">
          <span class="variant-badge">#{{vIdx + 1}}</span>
          <strong style="font-size:0.9rem;color:#0f172a">{{v.variantSku || 'New Variant'}}</strong>
          @if(v.colour){<span class="variant-pill">{{v.colour}}</span>}
          @if(v.heightMm && v.widthMm){<span class="variant-pill-dims">{{v.heightMm}}×{{v.widthMm}} mm</span>}
          @if(v.priceMinor){<span class="variant-pill-price">£{{(v.priceMinor/100)|number:'1.2-2'}}</span>}@if(v.discountPercent){<span class="variant-pill" style="background:#f0fdf4;color:#166534;border:1px solid #bbf7d0;font-weight:700">Save {{v.discountPercent}}%</span>}
        </div>
        <button type="button" class="variant-remove-btn" (click)="removeVariant(vIdx)" title="Remove Variant">✕ Remove</button>
      </div>

      <div class="variant-card-body">
        <!-- 1. Identification & Finish -->
        <div class="variant-subgroup">
          <div class="variant-subgroup-title">Identification & Finish</div>
          <div class="variant-grid-4">
            <label class="variant-field">
              <span>EAN / Barcode *</span>
              <input name="variantEan_{{vIdx}}" [ngModelOptions]="{standalone:true}" [(ngModel)]="v.ean" required placeholder="e.g. 5056123456789">
            </label>
            <label class="variant-field">
              <span>Variant SKU *</span>
              <input name="variantSku_{{vIdx}}" [ngModelOptions]="{standalone:true}" [(ngModel)]="v.variantSku" required placeholder="e.g. OXF-001-A">
            </label>
            <label class="variant-field">
              <span>Colour / Finish</span>
              <input name="variantColour_{{vIdx}}" [ngModelOptions]="{standalone:true}" [(ngModel)]="v.colour" placeholder="e.g. Matt Anthracite">
            </label>
            <label class="variant-field">
              <span>Panel Type</span>
              <input name="variantPanel_{{vIdx}}" [ngModelOptions]="{standalone:true}" [(ngModel)]="v.panel" placeholder="e.g. Type 22 (Double)">
            </label>
          </div>
        </div>

        <!-- 2. Dimensions & Output -->
        <div class="variant-subgroup">
          <div class="variant-subgroup-title">Dimensions & Heating Output</div>
          <div class="variant-grid-5">
            <label class="variant-field">
              <span>Height (mm)</span>
              <input type="number" name="variantHeight_{{vIdx}}" [ngModelOptions]="{standalone:true}" [(ngModel)]="v.heightMm" placeholder="600">
            </label>
            <label class="variant-field">
              <span>Width (mm)</span>
              <input type="number" name="variantWidth_{{vIdx}}" [ngModelOptions]="{standalone:true}" [(ngModel)]="v.widthMm" placeholder="1000">
            </label>
            <label class="variant-field">
              <span>Depth (mm)</span>
              <input type="number" name="variantDepth_{{vIdx}}" [ngModelOptions]="{standalone:true}" [(ngModel)]="v.depthMm" placeholder="100">
            </label>
            <label class="variant-field">
              <span>Watts</span>
              <input type="number" name="variantWatts_{{vIdx}}" [ngModelOptions]="{standalone:true}" [(ngModel)]="v.watts" placeholder="1250">
            </label>
            <label class="variant-field">
              <span>BTU</span>
              <input type="number" name="variantBtu_{{vIdx}}" [ngModelOptions]="{standalone:true}" [(ngModel)]="v.btu" placeholder="4265">
            </label>
          </div>
        </div>

        <!-- 3. Pricing, Inventory & Logistics -->
        <div class="variant-subgroup">
          <div class="variant-subgroup-title">Pricing, Stock & Availability</div>
          <div class="variant-grid-4">
            <label class="variant-field">
              <span>Price (£) *</span>
              <input type="number" step=".01" name="variantPrice_{{vIdx}}" [ngModelOptions]="{standalone:true}" [ngModel]="v.priceMinor/100" (ngModelChange)="v.priceMinor=toMinor($event)" placeholder="0.00">
            </label>
            <label class="variant-field">
              <span>Discount (% Off)</span>
              <input type="number" min="0" max="90" name="variantDiscount_{{vIdx}}" [ngModelOptions]="{standalone:true}" [(ngModel)]="v.discountPercent" placeholder="0">
            </label>
            <div class="variant-field">
              <span>Stock Quantity</span>
              <div class="stock-input-wrap">
                <input type="number" min="0" name="variantStock_{{vIdx}}" [ngModelOptions]="{standalone:true}" [(ngModel)]="v.stock" (input)="onVariantStockChange()" [disabled]="!!v.unlimitedStock" placeholder="0">
                <label class="variant-checkbox">
                  <input type="checkbox" name="vUnlimited_{{vIdx}}" [ngModelOptions]="{standalone:true}" [(ngModel)]="v.unlimitedStock" (change)="onVariantStockChange()">
                  <span>Unlimited</span>
                </label>
              </div>
            </div>
            <label class="variant-field">
              <span>Availability</span>
              <select name="variantAvailability_{{vIdx}}" [ngModelOptions]="{standalone:true}" [(ngModel)]="v.availability">
                <option value="IN_STOCK">In Stock (Ready to dispatch)</option>
                <option value="LEAD TIME">Lead Time (Standard)</option>
                <option value="LEAD_TIME">Lead Time (Standard)</option>
                <option value="AVAILABLE_TO_ORDER">Available to Order</option>
                <option value="MADE_TO_ORDER">Made to Order</option>
                <option value="BACKORDER">Backorder</option>
              </select>
            </label>
            <div class="variant-field-split">
              <label class="variant-field" style="flex:1">
                <span>Lead Time</span>
                <input name="variantLead_{{vIdx}}" [ngModelOptions]="{standalone:true}" [(ngModel)]="v.leadTime" placeholder="e.g. 2-3 Days">
              </label>
              <label class="variant-field" style="width:80px">
                <span>Warranty</span>
                <input type="number" name="variantWarranty_{{vIdx}}" [ngModelOptions]="{standalone:true}" [(ngModel)]="v.warrantyYears" placeholder="Yrs">
              </label>
            </div>
          </div>
        </div>

        <!-- 4. Images -->
        <div class="variant-subgroup">
          <div class="variant-subgroup-title">Variant Imagery</div>
          <div class="variant-images-row">
            @if(v.imageUrl){
              <div class="variant-image-thumb">
                <img [src]="v.imageUrl" alt="" onerror="this.style.display='none'">
              </div>
            }
            <label class="variant-field" style="flex:1.2">
              <span>Primary Variant Image URL</span>
              <input name="variantImageUrl_{{vIdx}}" [ngModelOptions]="{standalone:true}" [(ngModel)]="v.imageUrl" placeholder="/api/product-images/... or https://...">
            </label>
            <label class="variant-field" style="flex:1.8">
              <span>Additional Angle URLs (comma-separated)</span>
              <input name="variantImagesMulti_{{vIdx}}" [ngModelOptions]="{standalone:true}" [(ngModel)]="v.imageUrlsJson" placeholder="https://..., https://...">
            </label>
            <button type="button" class="secondary variant-pick-media-btn" (click)="openMediaPicker('variant', v)">
              🖼 Pick Media
            </button>
          </div>
        </div>
      </div>
    </div>
  }@empty{
    <div class="variant-empty-state">
      <span style="font-size:2rem">📦</span>
      <h4 style="margin:8px 0 4px;font-size:0.95rem;color:#1e293b">No variants configured yet</h4>
      <p style="margin:0 0 12px;font-size:0.82rem;color:#64748b">Add variants to offer multiple sizes, colours, finishes and heat outputs under this single product listing.</p>
      <button type="button" class="primary" (click)="addVariant()" style="font-size:0.8rem;padding:8px 16px">＋ Add First Variant</button>
    </div>
  }
</section><label class="full">Description<textarea name="description" rows="4" [(ngModel)]="productDraft.description"></textarea></label><div class="form-actions full"><button type="button" class="secondary" (click)="closeModal()">Cancel</button><button class="primary" [disabled]="saving()||uploadingImage()">{{saving()?'Saving & Syncing…':'💾 Save & Sync to Storefront'}}</button></div></form>}

 @if(modal()!.type==='bulkProducts'){<div class="bulk-modal-container"><div class="bulk-modal-tabs"><button type="button" [class.active]="bulkImportMode()==='csv'" (click)="bulkImportMode.set('csv')">CSV Spreadsheet</button><button type="button" [class.active]="bulkImportMode()==='excel'" (click)="bulkImportMode.set('excel')">Excel Workbook (.xlsx / .xls)</button></div>@if(bulkImportMode()==='csv'){<div class="bulk-section"><div class="bulk-intro"><div><h3>Import Products via CSV</h3><p>Upload a standard CSV file with product catalogue rows. Preview before importing and syncing.</p></div><button type="button" class="secondary" (click)="downloadProductImportSample()">⇩ Download Sample CSV</button></div><label class="upload-dropzone bulk-dropzone" [class.uploading]="importingProducts()"><input type="file" accept=".csv,text/csv" (change)="onCsvFileSelected($event)"><b>{{csvRawFilename()||'Choose CSV file or drag & drop here'}}</b><small>Columns: sku, name, brand, category, price, cost, stock, status, imageUrl</small></label>@if(parsedCsvProducts().length){<div class="csv-preview-card"><div class="csv-preview-header"><div class="preview-stats"><span class="badge green">✓ {{parsedCsvProducts().length}} rows detected</span><label class="checkbox-inline"><input type="checkbox" [(ngModel)]="csvAutoPublish"><span>Auto-publish all items to storefront (set status to PUBLISHED)</span></label></div></div><div class="table-wrap csv-preview-table-wrap"><table><thead><tr><th>SKU</th><th>Name</th><th>Category</th><th>Price</th><th>Stock</th><th>Status</th><th>Image</th></tr></thead><tbody>@for(row of parsedCsvProducts().slice(0,10);track row.sku){<tr><td><code>{{row.sku}}</code></td><td><strong>{{row.name}}</strong><small>{{row.brand}}</small></td><td>{{row.category}}</td><td><strong>{{row.priceMinor/100|currency:'GBP'}}</strong></td><td>{{row.stock}} units</td><td><span class="status" [attr.data-status]="csvAutoPublish()?'PUBLISHED':row.status">{{csvAutoPublish()?'PUBLISHED':row.status}}</span></td><td>@if(row.imageUrl){<span class="preview-thumb"><img [src]="row.imageUrl" alt="" onerror="this.style.display='none'"></span>}@else{<small class="muted">None</small>}</td></tr>}</tbody></table>@if(parsedCsvProducts().length>10){<p class="table-more-hint">...and {{parsedCsvProducts().length-10}} more rows</p>}</div><div class="bulk-actions"><button type="button" class="secondary" (click)="parsedCsvProducts.set([]);csvRawFilename.set('')">Clear</button><button type="button" class="primary" [disabled]="importingProducts()" (click)="confirmBulkCsvImport()">{{importingProducts()?'Importing & Syncing…':'⚡ Import '+parsedCsvProducts().length+' Products & Sync to Storefront'}}</button></div></div>}</div>}@if(bulkImportMode()==='excel'){<div class="bulk-section"><div class="bulk-intro"><div><h3>Import Master Excel Workbook</h3><p>Upload Excel spreadsheets (.xlsx, .xlsm, .xls) with standard headers (SKU, Name, Price, Stock, EAN) or supplier matrix columns.</p></div><button type="button" class="secondary" (click)="downloadExcelImportSample()">⇩ Download Sample Excel Template</button></div><label class="upload-dropzone bulk-dropzone" [class.uploading]="importingProducts()"><input type="file" accept=".xlsx,.xlsm,.xls" (change)="confirmBulkExcelImport($event)"><b>{{importingProducts()?'Parsing & importing workbook…':'Choose Excel Workbook (.xlsx, .xlsm)'}}</b><small>Supports standard headers (SKU, Product Name, Price, Stock, EAN) or supplier matrix headers</small></label><div class="excel-info-card"><h4>Smart Header & Variant Mapping</h4><p>Standard columns (<code>SKU</code>, <code>Product Name</code>, <code>Price</code>, <code>Stock</code>, <code>Category</code>, <code>EAN</code>) and supplier matrix columns are automatically recognized. Multi-row SKU groups create grouped products with options, and re-importing updates existing products seamlessly.</p></div></div>}</div>}

 @if(modal()!.type==='mediaManager'){<div class="media-modal-container"><div class="media-modal-tabs"><button type="button" [class.active]="mediaManagerTab()==='upload'" (click)="mediaManagerTab.set('upload')">Bulk Upload & Auto-Match</button><button type="button" [class.active]="mediaManagerTab()==='zip'" (click)="mediaManagerTab.set('zip')">ZIP Image Library</button><button type="button" [class.active]="mediaManagerTab()==='gallery'" (click)="mediaManagerTab.set('gallery');loadMediaGallery()">Media Gallery ({{uploadedMediaList().length}})</button></div>@if(mediaManagerTab()==='upload'){<div class="bulk-section"><div class="bulk-intro"><div><h3>Upload Multiple Product Images</h3><p>Upload multiple JPG, PNG, or WebP files at once. Files named by <strong>Product SKU</strong> (e.g. <code>OXF-001.jpg</code>) or <strong>Variant EAN</strong> (e.g. <code>5056123456789.jpg</code>) are automatically matched, linked to products, and synced to the storefront!</p></div></div><label class="upload-dropzone bulk-dropzone" [class.uploading]="uploadingBulkImages()"><input type="file" multiple accept="image/jpeg,image/png,image/gif,image/webp" (change)="uploadBulkImages($event)" [disabled]="uploadingBulkImages()"><b>{{uploadingBulkImages()?'Uploading and auto-matching images…':'Select or drop multiple image files (JPG, PNG, WebP)'}}</b><small>Hold Ctrl/Cmd or Shift to select multiple images simultaneously</small></label>@if(bulkImageResults().length){<div class="match-results-card"><h4>Uploaded Images & Match Status ({{bulkImageResults().length}} files)</h4><div class="match-results-list">@for(res of bulkImageResults();track res.filename){<div class="match-item" [class.matched]="res.matchType!=='NONE'"><img [src]="res.url" [alt]="res.originalName" class="match-thumb"><div class="match-info"><strong>{{res.originalName}}</strong><small>Stored as: <code>{{res.filename}}</code></small></div><div class="match-badge">@if(res.matchType==='EAN'||res.matchType==='SKU'){<span class="status" data-status="PUBLISHED">✓ {{res.matchedDetail}}</span>}@else{<span class="status" data-status="PENDING">Uploaded to Library (Unmatched)</span>}</div></div>}</div></div>}</div>}@if(mediaManagerTab()==='zip'){<div class="bulk-section"><div class="bulk-intro"><div><h3>Import Dropbox / Supplier ZIP Archive</h3><p>Upload a compressed <code>.zip</code> archive containing hundreds of high-resolution product images named by EAN (e.g. <code>5056123456789.jpg</code>).</p></div></div><label class="upload-dropzone bulk-dropzone" [class.uploading]="importingImages()"><input type="file" accept=".zip,application/zip" (change)="importImageLibrary($event)" [disabled]="importingImages()"><b>{{importingImages()?'Extracting, matching EANs, and syncing to storefront…':'Choose .ZIP archive of product images'}}</b><small>Images will be extracted, matched against all product variants, and synced automatically</small></label></div>}@if(mediaManagerTab()==='gallery'){<div class="bulk-section"><div class="gallery-controls"><div class="gallery-heading"><h3>Uploaded Media Assets</h3><p>All images currently stored in the system. Click any image to assign it directly to a product or copy its link.</p></div><button type="button" class="secondary" (click)="loadMediaGallery()">↻ Refresh Gallery</button></div>@if(loadingMedia()){<div class="loading-state">Loading media gallery…</div>}@else if(!uploadedMediaList().length){<div class="empty-state"><span>🖼</span><h3>No images in media library yet</h3><p>Upload individual images or bulk image packs using the upload tabs above.</p></div>}@else{<div class="media-grid">@for(img of uploadedMediaList();track img.filename){<div class="media-card" [class.selected]="selectedMediaUrl()===img.url"><div class="media-img-wrap" (click)="openAssignForImage(img,$event)"><img [src]="img.url" [alt]="img.filename" loading="lazy"></div><div class="media-meta"><span class="media-name" [title]="img.filename">{{img.filename}}</span>@if(img.assignedSku){<span class="media-assignment assigned" [title]="img.assignedName">✓ {{img.assignedSku}}</span>}@else{<span class="media-assignment unassigned">Unassigned</span>}<div class="media-actions"><button type="button" class="mini-btn" title="Copy URL" (click)="copyToClipboard(img.url)">📋 Copy</button><button type="button" class="mini-btn primary-mini" (click)="openAssignForImage(img,$event)">🔗 Assign</button>@if(img.assignedSku){<button type="button" class="mini-btn danger-mini" title="Unassign image from product" (click)="unassignSelectedImage(img.url,$event)">✕ De-assign</button>}</div></div>@if(selectedMediaUrl()===img.url){<div class="assign-popover" (click)="$event.stopPropagation()"><div class="assign-popover-header"><small>Assign image to product:</small><button type="button" class="assign-close-btn" (click)="selectedMediaUrl.set('')" title="Close">✕</button></div>@if(getSelectedProductForAssign(); as selProd){<div class="selected-product-card"><div class="sel-prod-details"><span class="sel-prod-name" [title]="selProd.name">✓ {{selProd.name}}</span><span class="sel-prod-sku">SKU: <code>{{selProd.sku}}</code></span></div><button type="button" class="sel-change-btn" (click)="clearAssignSelection()" title="Pick different product">Change</button></div>}@else{<div class="assign-search-box-wrap"><span class="search-lens">⌕</span><input type="text" class="assign-search-input" placeholder="Search by product name or SKU..." [ngModel]="assignProductSearch()" (ngModelChange)="assignProductSearch.set($event);onAssignSearchInput()" (focus)="assignDropdownOpen.set(true)"><@if(assignProductSearch()){<button type="button" class="search-clear-x" (click)="assignProductSearch.set('');onAssignSearchInput()">✕</button>}</div><div class="assign-dropdown-list"><div class="assign-list-header"><span>{{filteredProductsForAssign().length}} product(s)</span><small>Click to select</small></div><div class="assign-list-scroll">@for(prod of filteredProductsForAssign();track prod.id){<div class="assign-product-option" [class.active]="assignTargetProductId===prod.id" (click)="selectAssignProduct(prod)"><div class="opt-main"><div class="opt-name">{{prod.name}}</div><div class="opt-tags"><span class="opt-sku">SKU: <strong>{{prod.sku}}</strong></span>@if(prod.brand){<span class="opt-cat">{{prod.brand}}</span>}</div></div>@if(assignTargetProductId===prod.id){<span class="opt-check">✓</span>}</div>}@empty{<div class="assign-no-match"><span>No products match "{{assignProductSearch()}}"</span><small>Try a different keyword or SKU</small></div>}</div></div>}<div class="popover-btns"><button type="button" class="primary assign-submit-btn" [disabled]="!assignTargetProductId||assigningImage()" (click)="assignSelectedImage(img.url,assignTargetProductId!)">{{assigningImage()?'Saving…':'✓ Assign & Sync'}}</button>@if(img.assignedSku){<button type="button" class="mini-btn danger-mini" [disabled]="assigningImage()" (click)="unassignSelectedImage(img.url,$event)">✕ De-assign</button>}<button type="button" class="mini-btn" (click)="selectedMediaUrl.set('')">Cancel</button></div></div>}</div>}</div>}</div>}</div>}

 @if(modal()!.type==='customer'){<form (ngSubmit)="saveCustomer()" class="form-grid"><label>Full name<input name="name" [(ngModel)]="customerDraft.name" required></label><label>Email<input name="email" type="email" [(ngModel)]="customerDraft.email" required></label><label>Phone<input name="phone" [(ngModel)]="customerDraft.phone"></label><label>City<input name="city" [(ngModel)]="customerDraft.city"></label><label class="full">Admin notes<textarea name="notes" rows="3" [(ngModel)]="customerDraft.adminNotes"></textarea></label><div class="form-actions full"><button type="button" class="secondary" (click)="closeModal()">Cancel</button><button class="primary">Create customer</button></div></form>}
 @if(modal()!.type==='quote'){<form (ngSubmit)="saveQuote()" class="form-grid"><label>Customer name *<input name="qname" [(ngModel)]="quoteDraft.customerName" required placeholder="e.g. John Doe"></label><label>Customer email ID *<input name="qemail" type="email" [(ngModel)]="quoteDraft.customerEmail" required placeholder="customer@example.co.uk"></label><label class="full">Customer Delivery & Site Address *<textarea name="qaddr" [(ngModel)]="quoteDraft.customerAddress" rows="2" placeholder="Full delivery address & site postcode" required></textarea></label><label>Default Company Email<input name="qcompemail" type="email" [(ngModel)]="quoteDraft.companyEmail" placeholder="sales@theheatingandplumbing.com"></label><label>Expires on<input name="expires" type="date" [(ngModel)]="quoteDraft.expiresOn"></label><div class="full" style="background:#f8fafc;border:1px solid #cbd5e1;border-radius:8px;padding:16px"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;flex-wrap:wrap;gap:10px"><div><strong style="font-size:0.95rem;color:#0f172a">Product-Wise Selection & Pricing</strong><small class="d-block text-muted" style="font-size:0.75rem;margin-top:2px">Select any product or variant from your catalogue. Description, SKU and price auto-populate.</small></div><div style="display:flex;gap:8px;align-items:center"><div style="display:flex;align-items:center;position:relative"><input type="text" [ngModel]="quoteProductFilter()" (ngModelChange)="quoteProductFilter.set($event)" placeholder="Filter dropdown products…" style="font-size:0.8rem;padding:6px 24px 6px 10px;border:1px solid #cbd5e1;border-radius:6px;width:210px;background:#fff;margin:0">@if(quoteProductFilter()){<button type="button" (click)="quoteProductFilter.set('')" style="position:absolute;right:6px;background:none;border:none;color:#94a3b8;cursor:pointer;font-size:0.75rem" title="Clear filter">✕</button>}</div><button type="button" class="secondary" (click)="addQuoteLine()" style="white-space:nowrap;padding:7px 12px;font-size:0.8rem;margin:0">＋ Add Another Product</button></div></div><div style="display:grid;grid-template-columns:2.2fr 1.6fr 1.1fr 75px 105px 95px 36px;gap:8px;padding-bottom:6px;font-size:0.74rem;font-weight:700;color:#64748b;text-transform:uppercase"><span>Select Product (From Catalogue)</span><span>Description / Title</span><span>SKU</span><span>Qty</span><span>Unit Price (£)</span><span style="text-align:right">Line Total</span><span></span></div>@for(item of quoteDraft.lineItems;track $index;let idx=$index){<div style="display:grid;grid-template-columns:2.2fr 1.6fr 1.1fr 75px 105px 95px 36px;gap:8px;align-items:center;margin-bottom:8px;padding-bottom:8px;border-bottom:1px solid #e2e8f0"><select [(ngModel)]="item.selectedProductKey" (ngModelChange)="onQuoteProductSelected(item)" [name]="'psel_'+idx" style="font-size:0.82rem;padding:7px 10px;border:1px solid #cbd5e1;border-radius:6px;width:100%;height:38px;background:#fff;color:#0f172a;cursor:pointer;box-sizing:border-box"><option [ngValue]="null">-- Select Product ({{quoteProductCatalogue().length}} available) --</option>@for(p of quoteProductCatalogue(); track p.id){@if(p.variants && p.variants.length > 0){<optgroup [label]="p.name + ' (' + p.sku + ')'"><option [value]="'p_' + p.id">{{p.name}} (Main: {{p.sku}}) — £{{((p.priceMinor||0)/100)|number:'1.2-2'}}</option>@for(v of p.variants; track (v.variantSku || v.ean)){<option [value]="'v_' + p.id + '_' + (v.variantSku || v.ean)">↳ {{v.variantSku || v.ean}} ({{v.colour || 'Standard'}}{{v.heightMm ? ' ' + v.heightMm + '×' + v.widthMm + 'mm' : ''}}) — £{{((v.priceMinor || p.priceMinor)/100)|number:'1.2-2'}}</option>}</optgroup>}@else{<option [value]="'p_' + p.id">{{p.name}} ({{p.sku}}) — £{{((p.priceMinor||0)/100)|number:'1.2-2'}}</option>}}</select><input [(ngModel)]="item.productName" [name]="'pname_'+idx" placeholder="Product name" style="font-size:0.84rem;padding:7px 10px;height:38px;border:1px solid #cbd5e1;border-radius:6px;margin:0;box-sizing:border-box" required><input [(ngModel)]="item.sku" [name]="'psku_'+idx" placeholder="SKU" style="font-size:0.84rem;padding:7px 10px;height:38px;border:1px solid #cbd5e1;border-radius:6px;margin:0;box-sizing:border-box"><input type="number" min="1" [(ngModel)]="item.quantity" [name]="'pqty_'+idx" style="font-size:0.84rem;padding:7px 8px;height:38px;border:1px solid #cbd5e1;border-radius:6px;margin:0;box-sizing:border-box"><input type="number" step="0.01" min="0" [(ngModel)]="item.unitPrice" [name]="'pprice_'+idx" style="font-size:0.84rem;padding:7px 8px;height:38px;border:1px solid #cbd5e1;border-radius:6px;margin:0;box-sizing:border-box"><span style="text-align:right;font-weight:700;font-size:0.88rem;color:#0f172a;white-space:nowrap">£{{((item.quantity||0)*(item.unitPrice||0))|number:'1.2-2'}}</span><button type="button" class="delete-btn" (click)="removeQuoteLine(idx)" [disabled]="quoteDraft.lineItems.length<=1" style="padding:6px;margin:0;height:38px;width:36px;display:inline-flex;align-items:center;justify-content:center" title="Remove Item">✕</button></div>}<div style="display:flex;justify-content:space-between;align-items:center;margin-top:12px;padding-top:12px;border-top:1px solid #cbd5e1"><span class="muted" style="font-size:0.85rem">Fixed 20% VAT calculated automatically. Customer estimate displays total price directly.</span><strong style="font-size:1.15rem;color:var(--navy,#14263e)">Total: {{quoteTotalCalculated|currency:'GBP'}}</strong></div></div><div class="full quote-smtp-card"><strong>✉ Hostinger SMTP Configuration Configured</strong><span>SMTP Server: <code>smtp.hostinger.com</code> | Port: <code>465 (SSL)</code> | Default Sender: <code>sales@theheatingandplumbing.com</code></span></div><div class="form-actions full"><button type="button" class="secondary" (click)="closeModal()">Cancel</button><button class="primary" [disabled]="savingQuote()">{{savingQuote()?'Saving…':(quoteDraft.id?'💾 Update & Save Quotation':'💾 Create Quotation')}}</button></div></form>}

@if(modal()!.type==='quoteDetails'){<div class="quote-doc-container"><div class="quote-doc-header"><div class="quote-doc-brand"><img src="/thp-logo.jpg" alt="THP Logo"><div><strong style="font-size:1.1rem;display:block">THE HEATING & PLUMBING</strong><small class="muted">Dignitree Ltd • UK Specialist Heating & Plumbing</small><br><small class="muted">✉ {{selectedQuoteDetails?.companyEmail||'sales@theheatingandplumbing.com'}} • ☎ +44 7404 095699</small></div></div><div class="quote-doc-meta"><h3>{{selectedQuoteDetails?.quoteNumber}}</h3><p>Date: {{selectedQuoteDetails?.createdAt|date:'mediumDate'}}</p><p>Valid Until: {{selectedQuoteDetails?.expiresOn|date:'mediumDate'}}</p><p>Status: <span class="badge green">{{selectedQuoteDetails?.status}}</span></p></div></div><div class="quote-doc-addresses"><div><h4>Customer Delivery & Site Address</h4><strong style="display:block;font-size:1rem">{{selectedQuoteDetails?.customerName}}</strong><p>✉ {{selectedQuoteDetails?.customerEmail}}</p><p style="white-space:pre-line;margin-top:4px">{{selectedQuoteDetails?.customerAddress||'No specific site address supplied'}}</p></div><div><h4>Issued By</h4><strong>Dignitree Ltd t/a The Heating & Plumbing</strong><p>71-75 Shelton Street, Covent Garden</p><p>London, WC2H 9JQ, United Kingdom</p><p>Company Reg: 14502391</p></div></div><table class="quote-doc-table"><thead><tr><th>#</th><th>Product / Description</th><th>SKU</th><th style="text-align:center">Quantity</th><th style="text-align:right">Unit Price</th><th style="text-align:right">Line Total</th></tr></thead><tbody>@for(item of parseQuoteLines(selectedQuoteDetails?.lineItemsJson); track $index; let i = $index){<tr><td>{{i+1}}</td><td><strong>{{item.productName||'Specialist Heating Item'}}</strong></td><td><code>{{item.sku||'THP-SPEC'}}</code></td><td style="text-align:center">{{item.quantity}}</td><td style="text-align:right">{{item.unitPrice|currency:'GBP'}}</td><td style="text-align:right"><strong>{{(item.quantity*item.unitPrice)|currency:'GBP'}}</strong></td></tr>}</tbody></table><div class="quote-doc-total-box"><div style="text-align:right"><p style="margin:0 0 4px;font-size:0.85rem;color:#647084">All prices inclusive of 20% UK VAT & Standard UK Freight</p><strong>Total Price: {{(selectedQuoteDetails?.totalMinor||0)/100|currency:'GBP'}}</strong></div></div><div class="quote-smtp-card btn-no-print"><strong>✉ Hostinger SMTP Mailer Ready</strong><span>Connected to <code>smtp.hostinger.com:465</code>. Quotation estimate ready for customer dispatch or PDF download.</span></div><div class="form-actions btn-no-print" style="margin-top:24px;border-top:1px solid #e2e8f0;padding-top:16px"><button type="button" class="secondary" (click)="closeModal()">Close</button><button type="button" class="secondary" [disabled]="sendingQuoteEmail()" (click)="sendQuoteEmail(selectedQuoteDetails)">{{sendingQuoteEmail() ? 'Sending…' : '✉ Email Quotation to Customer'}}</button><button type="button" class="primary" (click)="printDocument()">🖨 Download PDF / Print</button></div></div>}

@if(modal()!.type==='sendCustomerOrder'){<div style="padding:24px"><div style="margin-bottom:16px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:16px"><h3 style="margin:0 0 6px;color:#166534">Dispatch & Courier Tracking Notification</h3><p style="margin:0;font-size:0.86rem;color:#15803d">An official dispatch and live delivery tracking email will be sent to the customer.</p></div><div style="display:flex;flex-direction:column;gap:12px;font-size:0.88rem"><div><strong>Order Number:</strong> {{selectedOrderForUpdate?.orderNumber}}</div><div><strong>Customer:</strong> {{selectedOrderForUpdate?.customerName}} (<code>{{selectedOrderForUpdate?.customerEmail}}</code>)</div><div><strong>Courier:</strong> {{selectedOrderForUpdate?.carrier||'DPD Express Tracked 24'}}</div><div><strong>Tracking Reference:</strong> <code>{{selectedOrderForUpdate?.trackingNumber||'Awaiting Initial Scan'}}</code></div><div><strong>Fulfilment:</strong> <span class="badge green">{{selectedOrderForUpdate?.fulfilmentStatus||'DISPATCHED'}}</span></div><label>Optional Dispatch Notes to Customer:<textarea [(ngModel)]="orderCustomerNote" rows="3" placeholder="e.g. Your designer radiators have been dispatched from our central warehouse and are booked for delivery tomorrow."></textarea></label></div><div class="form-actions" style="margin-top:20px"><button type="button" class="secondary" (click)="closeModal()">Cancel</button><button type="button" class="primary" [disabled]="sendingCustomerNotification()" (click)="confirmSendOrderUpdate()">{{sendingCustomerNotification()?'Sending…':'✉ Send Email to Customer'}}</button></div></div>}

@if(modal()!.type==='sendCustomerInquiry'){<div style="padding:24px"><div style="margin-bottom:16px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:16px"><h3 style="margin:0 0 6px;color:#166534">Customer Resolution & Response Notification</h3><p style="margin:0;font-size:0.86rem;color:#15803d">An official technical resolution email will be sent directly to the customer.</p></div><div style="display:flex;flex-direction:column;gap:12px;font-size:0.88rem"><div><strong>Support Ticket:</strong> #{{selectedInquiryForUpdate?.ticketNumber||('TKT-'+selectedInquiryForUpdate?.id)}}</div><div><strong>Customer:</strong> {{selectedInquiryForUpdate?.name||selectedInquiryForUpdate?.customerName}} (<code>{{selectedInquiryForUpdate?.email||selectedInquiryForUpdate?.customerEmail}}</code>)</div><div><strong>Category:</strong> {{selectedInquiryForUpdate?.category}}</div><label>Resolution Message / Response:<textarea [(ngModel)]="inquiryCustomerMessage" rows="4" placeholder="e.g. Thank you for contacting THP Technical Support. We have processed your warranty claim and your replacement valve has been scheduled for dispatch."></textarea></label></div><div class="form-actions" style="margin-top:20px"><button type="button" class="secondary" (click)="closeModal()">Cancel</button><button type="button" class="primary" [disabled]="sendingCustomerNotification()" (click)="confirmSendInquiryResponse()">{{sendingCustomerNotification()?'Sending…':'✉ Send Response to Customer'}}</button></div></div>}

@if(modal()!.type==='company'){<form (ngSubmit)="saveCompany()" class="form-grid"><label>Brand / Company Name *<input name="bname" [(ngModel)]="companyDraft.name" required placeholder="e.g. Hearth Luxury Radiators"></label><label>Brand Code *<input name="bcode" [(ngModel)]="companyDraft.code" required placeholder="e.g. HEARTH" style="text-transform:uppercase"></label><div class="full" style="display:flex;gap:8px;align-items:center"><label style="flex:1">Brand Logo URL<input name="blogo" [(ngModel)]="companyDraft.logoUrl" placeholder="https://... or /uploads/..."></label><button type="button" class="secondary" (click)="openMediaPicker('company')" style="margin-top:20px;white-space:nowrap">🖼 Pick Logo Image</button></div><label>Official Website<input name="bweb" type="url" [(ngModel)]="companyDraft.website" placeholder="https://brand.co.uk"></label><label>Contact Email<input name="bmail" type="email" [(ngModel)]="companyDraft.contactEmail" placeholder="support@brand.co.uk"></label><label>Contact Phone<input name="bphone" [(ngModel)]="companyDraft.contactPhone" placeholder="+44 20 ..."></label><label>Country of Origin<input name="bcountry" [(ngModel)]="companyDraft.country" placeholder="United Kingdom"></label><label>Display Sort Order<input name="bsort" type="number" [(ngModel)]="companyDraft.sortOrder" min="1"></label><label>Status<select name="bstatus" [(ngModel)]="companyDraft.status"><option value="ACTIVE">ACTIVE (Visible on Storefront)</option><option value="INACTIVE">INACTIVE</option></select></label><label class="full">Description & Manufacturer Warranty Terms<textarea name="bdesc" rows="3" [(ngModel)]="companyDraft.description" placeholder="Brief manufacturer summary, warranty coverage details, or brand ethos..."></textarea></label><div class="form-actions full"><button type="button" class="secondary" (click)="closeModal()">Cancel</button><button class="primary" [disabled]="savingCompany()">{{savingCompany()?'Saving…':'💾 Save Brand'}}</button></div></form>}
@if(modal()!.type==='review'){<form (ngSubmit)="saveReview()" class="form-grid"><label>Customer Name *<input name="rauthor" [(ngModel)]="reviewDraft.author" required placeholder="e.g. Sarah Jenkins"></label><label>Customer Email<input name="remail" type="email" [(ngModel)]="reviewDraft.authorEmail" placeholder="customer@example.co.uk"></label><label>Customer Role / Badge<input name="rrole" [(ngModel)]="reviewDraft.role" placeholder="e.g. Verified Homeowner, Trade Plumber"></label><label>Customer Location<input name="rloc" [(ngModel)]="reviewDraft.location" placeholder="e.g. Surrey, UK"></label><label>Rating (1 to 5 Stars) *<select name="rrating" [(ngModel)]="reviewDraft.rating"><option [ngValue]="5">★★★★★ 5 Stars (Excellent)</option><option [ngValue]="4">★★★★☆ 4 Stars (Very Good)</option><option [ngValue]="3">★★★☆☆ 3 Stars (Average)</option><option [ngValue]="2">★★☆☆☆ 2 Stars (Below Average)</option><option [ngValue]="1">★☆☆☆☆ 1 Star (Poor)</option></select></label><label>Category<input name="rcat" [(ngModel)]="reviewDraft.category" placeholder="e.g. Designer Radiators"></label><label>Associated Product / SKU<input name="rsku" [(ngModel)]="reviewDraft.productSku" placeholder="e.g. OXF-001"></label><label>Moderation Status<select name="rstatus" [(ngModel)]="reviewDraft.status"><option value="APPROVED">APPROVED (Published on Storefront)</option><option value="PENDING_APPROVAL">PENDING_APPROVAL (Pending Moderation)</option><option value="REJECTED">REJECTED (Hidden)</option></select></label><label class="checkbox-inline full" style="margin-top:4px"><input type="checkbox" name="rverified" [(ngModel)]="reviewDraft.verified"><span>Verified Genuine Purchaser</span></label><label class="full">Review Headline *<input name="rtitle" [(ngModel)]="reviewDraft.title" required placeholder="e.g. Outstanding heat output and exceptional finish!"></label><label class="full">Review Comment / Content *<textarea name="rcomment" rows="4" [(ngModel)]="reviewDraft.comment" required placeholder="Detailed customer feedback and experience..."></textarea></label><div class="form-actions full"><button type="button" class="secondary" (click)="closeModal()">Cancel</button><button class="primary" [disabled]="savingReview()">{{savingReview()?'Saving…':'💾 Save Review'}}</button></div></form>}
 @if(modal()!.type==='stock'){<form (ngSubmit)="saveStock()" class="form-grid"><label class="full"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px"><span>Select Product to Adjust</span><small class="muted">{{filteredStockProducts().length}} products found</small></div><div style="display:flex;gap:8px;margin-bottom:6px"><input type="text" [ngModel]="stockProductSearch()" (ngModelChange)="stockProductSearch.set($event)" name="stockSearch" placeholder="Filter by product name or SKU..." style="flex:1;padding:7px 10px;font-size:0.84rem;border:1px solid #cbd5e1;border-radius:6px">@if(stockProductSearch()){<button type="button" class="secondary" (click)="stockProductSearch.set('')" style="padding:4px 8px;font-size:0.75rem">✕ Clear</button>}</div><select name="product" [(ngModel)]="stockDraft.productId" required><option [ngValue]="null">-- Choose a product ({{filteredStockProducts().length}} options) --</option>@for(p of filteredStockProducts();track p.id){<option [ngValue]="p.id">{{p.name}} (SKU: {{p.sku}}) — Current Stock: {{p.stock}}</option>}</select></label><label>Movement Direction<select name="type" [(ngModel)]="stockDraft.type"><option value="ADD">Add Stock (+)</option><option value="REMOVE">Remove Stock (-)</option></select></label><label>Quantity<input name="qty" type="number" min="1" [(ngModel)]="stockDraft.quantity" required></label><label>Warehouse<input name="warehouse" [(ngModel)]="stockDraft.warehouse" placeholder="Main Warehouse" required></label><label>Reference / PO / RMA #<input name="ref" [(ngModel)]="stockDraft.reference" placeholder="e.g. PO-1042 or RMA-88"></label><label class="full">Reason / Audit Trail Note<input name="reason" [(ngModel)]="stockDraft.reason" required placeholder="e.g. Supplier delivery, Damaged stock write-off, Physical count correction"></label><div class="form-actions full"><button type="button" class="secondary" (click)="closeModal()">Cancel</button><button class="primary" [disabled]="saving()">{{saving()?'Recording & Syncing…':'Record adjustment'}}</button></div></form>}
 @if(modal()!.type==='content'){<div><div style="padding:16px 26px 0"><div class="cms-modal-tabs"><button type="button" [class.active]="contentEditorTab==='editor'" (click)="contentEditorTab='editor'">✍ Editor (HTML & Content)</button><button type="button" [class.active]="contentEditorTab==='preview'" (click)="contentEditorTab='preview'">👁 Live HTML Viewer</button></div></div>@if(contentEditorTab==='editor'){<form (ngSubmit)="saveContent()" class="form-grid" style="padding-top:6px"><label>Title<input name="title" [(ngModel)]="contentDraft.title" required placeholder="e.g. Terms & Conditions"></label><label>Slug<input name="slug" [(ngModel)]="contentDraft.slug" required placeholder="e.g. terms-and-conditions"></label><label>Type<select name="ctype" [(ngModel)]="contentDraft.type"><option>PAGE</option><option>LANDING_PAGE</option><option>BANNER</option><option>FAQ</option></select></label><label>Status<select name="cstatus" [(ngModel)]="contentDraft.status"><option>PUBLISHED</option><option>DRAFT</option></select></label><label class="full">SEO Title<input name="seo" [(ngModel)]="contentDraft.seoTitle" placeholder="Page title for search engines"></label><div class="full"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px"><label style="margin:0;font-size:0.75rem;font-weight:700">Page Content / HTML Markup</label><small class="muted">Supports rich HTML or plain text</small></div><div class="cms-toolbar"><button type="button" class="cms-toolbar-btn" (click)="insertTag('b')"><b>B</b></button><button type="button" class="cms-toolbar-btn" (click)="insertTag('i')"><i>I</i></button><button type="button" class="cms-toolbar-btn" (click)="insertTag('h3')">H3</button><button type="button" class="cms-toolbar-btn" (click)="insertTag('p')">&para; P</button><button type="button" class="cms-toolbar-btn" (click)="insertTag('ul')">• List</button><button type="button" class="cms-toolbar-btn" (click)="insertTag('quote')">&ldquo; Quote</button><button type="button" class="cms-toolbar-btn" (click)="insertTag('table')">⊞ Table</button><button type="button" class="cms-toolbar-btn" (click)="insertTag('link')">🔗 Contact Link</button></div><textarea name="body" rows="12" [(ngModel)]="contentDraft.body" style="font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:0.86rem;line-height:1.5;white-space:pre-wrap" placeholder="Enter page text, policy terms, FAQ content, or HTML tags..."></textarea></div><div class="full" style="background:#f9fafb;border:1px solid var(--line);border-radius:0.75rem;padding:16px;margin-top:6px"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px"><div><strong style="font-size:0.82rem;color:var(--ink)">Official Document / PDF Attachment</strong><small class="d-block muted" style="font-size:0.68rem;margin-top:2px">Upload official PDF terms, policy documents, or warranty certificates. Synced to storefront for customer download.</small></div></div>@if(contentDraft.pdfFilename){<div class="cms-pdf-card"><div class="cms-pdf-info"><span style="font-size:1.6rem">📄</span><div><strong>{{contentDraft.pdfFilename}}</strong><small class="d-block" style="color:var(--green)">✓ Uploaded & Synced</small></div></div><div class="cms-pdf-actions"><a [href]="contentDraft.pdfUrl" target="_blank" class="mini-btn primary-mini" style="text-decoration:none">👁 View PDF</a><button type="button" class="mini-btn danger-mini" (click)="removeCmsPdf()">✕ Remove PDF</button></div></div>}<label class="upload-dropzone" [class.uploading]="uploadingPdf()" style="margin-top:10px;min-height:80px"><input type="file" accept="application/pdf,.pdf" (change)="uploadCmsPdf($event)" [disabled]="uploadingPdf()"><b>{{uploadingPdf()?'Uploading and syncing PDF document…':(contentDraft.pdfFilename?'Replace attached PDF file':'Choose or drop PDF document (.pdf)')}}</b><small>PDF format · up to 25 MB · instantly synced to Storefront</small></label></div><div class="form-actions full"><button type="button" class="secondary" (click)="closeModal()">Cancel</button><button class="primary" [disabled]="saving()||uploadingPdf()">{{saving()?'Saving…':(contentDraft.id?'💾 Update & Sync':'＋ Create & Sync')}}</button></div></form>}@if(contentEditorTab==='preview'){<div style="padding:10px 26px 24px"><div style="margin-bottom:16px;display:flex;justify-content:space-between;align-items:center"><div><span class="eyebrow">{{contentDraft.type||'PAGE'}}</span><h2 style="margin:4px 0">{{contentDraft.title||'Untitled Page'}}</h2><small class="muted">Slug: <code>/{{contentDraft.slug||'slug'}}</code></small></div><span class="badge" [class.green]="contentDraft.status==='PUBLISHED'">{{contentDraft.status||'DRAFT'}}</span></div>@if(contentDraft.pdfFilename){<div class="cms-pdf-card" style="margin-bottom:16px"><div class="cms-pdf-info"><span style="font-size:1.4rem">📄</span><div><strong>Attached Official PDF: {{contentDraft.pdfFilename}}</strong><small class="d-block" style="color:var(--green)">Available for customer view & download on storefront</small></div></div><a [href]="contentDraft.pdfUrl" target="_blank" class="mini-btn primary-mini" style="text-decoration:none">👁 View PDF</a></div>}<div class="cms-live-preview-body" [innerHTML]="renderCmsHtml(contentDraft.body)"></div><div class="form-actions" style="margin-top:20px"><button type="button" class="secondary" (click)="contentEditorTab='editor'">← Back to Editor</button><button type="button" class="primary" (click)="saveContent()" [disabled]="saving()||uploadingPdf()">{{saving()?'Saving…':'💾 Save & Sync Page'}}</button></div></div>}</div>}
 @if(modal()!.type==='htmlViewer'){<div style="padding:20px 26px 24px"><div style="margin-bottom:16px;display:flex;justify-content:space-between;align-items:center"><div><span class="eyebrow">{{modal()!.data?.type||'PAGE'}}</span><h2 style="margin:4px 0">{{modal()!.data?.title}}</h2><small class="muted">Slug: <code>/{{modal()!.data?.slug}}</code></small></div><span class="badge" [class.green]="modal()!.data?.status==='PUBLISHED'">{{modal()!.data?.status}}</span></div>@if(modal()!.data?.pdfFilename){<div class="cms-pdf-card" style="margin-bottom:16px"><div class="cms-pdf-info"><span style="font-size:1.4rem">📄</span><div><strong>Attached PDF: {{modal()!.data.pdfFilename}}</strong><small class="d-block" style="color:var(--green)">Synchronized with Storefront</small></div></div><a [href]="modal()!.data.pdfUrl" target="_blank" class="mini-btn primary-mini" style="text-decoration:none">👁 View / Download PDF</a></div>}<div class="cms-live-preview-body" style="max-height:55vh;overflow-y:auto" [innerHTML]="renderCmsHtml(modal()!.data?.body)"></div><div class="form-actions" style="margin-top:20px"><button type="button" class="secondary" (click)="closeModal()">Close Viewer</button><button type="button" class="primary" (click)="editContent(modal()!.data)">✏ Edit Page</button></div></div>}

 @if(modal()!.type==='dispatchOrder'){<form (ngSubmit)="saveDispatch()" class="form-grid"><div class="full"><strong>Dispatch Consignment for {{orderDraft.orderNumber}}</strong><small class="d-block text-muted">Customer: {{orderDraft.customerName}} ({{orderDraft.customerEmail}})</small></div><label>Order Status<select name="ordStatus" [(ngModel)]="orderDraft.orderStatus"><option value="PROCESSING">PROCESSING</option><option value="DISPATCHED">DISPATCHED</option><option value="DELIVERED">DELIVERED</option><option value="CANCELLED">CANCELLED</option></select></label><label>Fulfilment Status<select name="fulStatus" [(ngModel)]="orderDraft.fulfilmentStatus"><option value="UNFULFILLED">UNFULFILLED</option><option value="ALLOCATED">ALLOCATED</option><option value="DISPATCHED">DISPATCHED</option><option value="DELIVERED">DELIVERED</option></select></label><label>Courier Carrier<input name="carrier" [(ngModel)]="orderDraft.carrier" placeholder="DPD Express 24, Royal Mail 48, etc."></label><label>Tracking Consignment Number<input name="tracking" [(ngModel)]="orderDraft.trackingNumber" placeholder="e.g. DPD-GB-9842104"></label><label class="full">Estimated Delivery Window<input name="estDelivery" [(ngModel)]="orderDraft.estimatedDelivery" placeholder="Tomorrow, 10:30 AM – 1:30 PM"></label><label class="full">Fulfillment Warehouse<input name="wh" [(ngModel)]="orderDraft.warehouse" placeholder="Main Central Depot Leeds"></label><div class="form-actions full"><button type="button" class="secondary" (click)="closeModal()">Cancel</button><button class="primary" [disabled]="saving()">{{saving()?'Saving…':'Save'}}</button></div></form>}
  @if(modal()!.type==='promotion'){<form (ngSubmit)="savePromotion()" class="form-grid"><label>Coupon Code<input name="pcode" [(ngModel)]="promoDraft.code" style="text-transform:uppercase" placeholder="e.g. SUMMER15" required></label><label>Display Label<input name="plabel" [(ngModel)]="promoDraft.label" placeholder="e.g. 15% Summer Radiator Sale" required></label><label>Discount Type<select name="ptype" [(ngModel)]="promoDraft.discountType"><option value="PERCENT">Percentage (%) Off</option><option value="AMOUNT">Fixed Amount (£) Off</option><option value="FREE_SHIPPING">Free Shipping Voucher</option></select></label><label>Discount Value<input type="number" name="pval" [(ngModel)]="promoDraft.discountValue" placeholder="10 (for 10% or £10)"></label><label>Min Basket (£)<input type="number" name="pmin" [(ngModel)]="promoMinBasket" placeholder="0 for no minimum"></label><label>Active Status<select name="pact" [(ngModel)]="promoDraft.active"><option [ngValue]="true">Active & Usable</option><option [ngValue]="false">Paused / Inactive</option></select></label><div class="form-actions full"><button type="button" class="secondary" (click)="closeModal()">Cancel</button><button class="primary" [disabled]="saving()">{{saving()?'Saving…':'💾 Save & Sync to Storefront'}}</button></div></form>}
  @if(modal()!.type==='inquiryDetails'){<div style="padding:20px 24px 24px;display:flex;flex-direction:column;gap:16px"><div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;border-bottom:1px solid #e2e8f0;padding-bottom:12px"><div><span class="eyebrow">TICKET #{{selectedInquiry()?.ticketNumber || ('TKT-' + selectedInquiry()?.id)}}</span><h3 style="margin:4px 0 2px">{{selectedInquiry()?.category || 'Customer Inquiry / Claim'}}</h3><small class="muted">Submitted: {{selectedInquiry()?.createdAt|date:'medium'}}</small></div><span class="status" [attr.data-status]="selectedInquiry()?.status">{{pretty(selectedInquiry()?.status)}}</span></div>@if(selectedInquiry()?.orderVerified){<div class="verification-card verified"><div style="display:flex;justify-content:space-between;align-items:center"><strong style="color:#166534;font-size:0.92rem">✓ Genuine Verified Store Purchase</strong><span class="badge green">Order #{{selectedInquiry()?.orderNumber}}</span></div><dl class="detail-grid" style="grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px;margin-top:10px"><div><dt>Order Placed</dt><dd>{{selectedInquiry()?.verifiedOrder?.createdAt|date:'medium'}}</dd></div><div><dt>Order Total</dt><dd><strong>{{selectedInquiry()?.verifiedOrder?.totalMinor/100|currency:'GBP'}}</strong></dd></div><div><dt>Customer on Order</dt><dd>{{selectedInquiry()?.verifiedOrder?.customerName}}</dd></div><div><dt>Order Email</dt><dd>{{selectedInquiry()?.verifiedOrder?.customerEmail}}</dd></div><div><dt>Email Verification</dt><dd><span [style.color]="selectedInquiry()?.emailMatchesOrder?'#166534':'#b45309'">{{selectedInquiry()?.emailMatchesOrder?'✓ Matches Inquiry Email':'⚠️ Different from Inquiry Email'}}</span></dd></div><div><dt>Fulfilment</dt><dd><span class="status" [attr.data-status]="selectedInquiry()?.verifiedOrder?.orderStatus">{{pretty(selectedInquiry()?.verifiedOrder?.orderStatus)}}</span></dd></div></dl></div>}@else if(selectedInquiry()?.hasOrderNumber && !selectedInquiry()?.orderVerified){<div class="verification-card unverified"><div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px"><div><strong style="color:#991b1b;font-size:0.92rem">⚠️ Unverified Purchase: Order Not Found in System</strong><p style="margin:4px 0 0;font-size:0.82rem;color:#7f1d1d">Customer provided order reference <code>#{{selectedInquiry()?.orderNumber}}</code>, but no matching order exists in store orders. This query may be unverified or invalid.</p></div><button type="button" class="reject-btn" style="white-space:nowrap;padding:7px 12px;font-size:0.75rem" (click)="rejectInquiryAsUnverified()">✕ Reject Ticket as Unverified</button></div></div>}@else{<div class="verification-card none"><strong style="color:#475569;font-size:0.88rem">ℹ️ Pre-Purchase / General Inquiry</strong><p style="margin:2px 0 0;font-size:0.8rem;color:#64748b">No order reference provided by customer.</p></div>}<div class="panel" style="background:#f8fafc;padding:16px;border-radius:8px;border:1px solid #e2e8f0"><h4 style="margin:0 0 10px;font-size:0.92rem;color:#475569">Customer & Order Details</h4><dl class="detail-grid" style="grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px;margin:0"><div><dt>Customer Name</dt><dd><strong>{{selectedInquiry()?.name || selectedInquiry()?.customerName || 'Customer'}}</strong></dd></div><div><dt>Email</dt><dd><a [href]="'mailto:' + (selectedInquiry()?.email || selectedInquiry()?.customerEmail)">{{selectedInquiry()?.email || selectedInquiry()?.customerEmail || '—'}}</a></dd></div><div><dt>Phone / WhatsApp</dt><dd><a *ngIf="selectedInquiry()?.phone || selectedInquiry()?.customerPhone" [href]="'tel:' + (selectedInquiry()?.phone || selectedInquiry()?.customerPhone)">📞 {{selectedInquiry()?.phone || selectedInquiry()?.customerPhone}}</a><span *ngIf="!selectedInquiry()?.phone && !selectedInquiry()?.customerPhone">—</span></dd></div><div><dt>Order Reference</dt><dd><strong *ngIf="selectedInquiry()?.orderNumber" [style.color]="selectedInquiry()?.orderVerified?'#16a34a':'#dc2626'">#{{selectedInquiry()?.orderNumber}}</strong><span *ngIf="!selectedInquiry()?.orderNumber" class="muted">None (General Inquiry)</span></dd></div><div><dt>Product / Part</dt><dd><span *ngIf="selectedInquiry()?.productName">📦 {{selectedInquiry()?.productName}} <code *ngIf="selectedInquiry()?.productSku">({{selectedInquiry()?.productSku}})</code></span><span *ngIf="!selectedInquiry()?.productName" class="muted">—</span></dd></div></dl></div><div class="panel" style="background:#fff;padding:16px;border:1px solid #e2e8f0;border-radius:8px"><h4 style="margin:0 0 8px;font-size:0.92rem;color:#475569">Customer Inquiry & Defect Description</h4><p style="white-space:pre-wrap;line-height:1.6;margin:0;font-size:0.92rem;color:#1e293b">{{selectedInquiry()?.message}}</p></div>@if(selectedInquiry()?.attachmentUrl){<div class="panel" style="background:#fff;padding:16px;border:1px solid #e2e8f0;border-radius:8px"><h4 style="margin:0 0 10px;font-size:0.92rem;color:#475569">📎 Evidence Attachment (Photo / Document)</h4>@if(isImage(selectedInquiry()?.attachmentUrl)){<div style="display:flex;align-items:flex-start;gap:16px"><a [href]="selectedInquiry()?.attachmentUrl" target="_blank" title="Click to view full photo"><img [src]="selectedInquiry()?.attachmentUrl" alt="Customer Attachment" (error)="onThumbError($event)" style="max-width:260px;max-height:200px;object-fit:contain;border-radius:6px;border:1px solid #cbd5e1;box-shadow:0 2px 4px rgba(0,0,0,0.06)"></a><div><strong>{{selectedInquiry()?.attachmentFilename || 'Attached Photo'}}</strong><p class="muted" style="font-size:0.82rem;margin:4px 0 10px">Customer provided photo evidence of issue/product.</p><a [href]="selectedInquiry()?.attachmentUrl" target="_blank" class="mini-btn secondary-mini" style="text-decoration:none">🔍 Open Full Photo in New Tab</a></div></div>}@else{<div style="display:flex;align-items:center;gap:12px"><span style="font-size:2rem">📄</span><div><strong>{{selectedInquiry()?.attachmentFilename || 'Attached PDF Document'}}</strong><p class="muted" style="font-size:0.82rem;margin:2px 0 8px">Customer uploaded PDF invoice or documentation.</p><a [href]="selectedInquiry()?.attachmentUrl" target="_blank" class="mini-btn primary-mini" style="text-decoration:none">👁 View Document</a></div></div>}</div>}<div class="panel" [style.background]="inquiryDetailStatus==='REJECTED'?'#fef2f2':'#f0fdf4'" [style.borderColor]="inquiryDetailStatus==='REJECTED'?'#fca5a5':'#bbf7d0'" style="padding:16px;border:1px solid;border-radius:8px"><h4 [style.color]="inquiryDetailStatus==='REJECTED'?'#991b1b':'#166534'" style="margin:0 0 6px;font-size:0.92rem">Specialist Resolution & Response Notes</h4><small class="muted" style="display:block;margin-bottom:8px">These notes are visible to the customer when they track their ticket on the Storefront.</small><textarea [(ngModel)]="inquiryResolutionNote" rows="3" placeholder="Provide troubleshooting advice, warranty replacement tracking, or rejection reason..." style="width:100%;box-sizing:border-box"></textarea><div style="margin-top:12px;display:flex;gap:12px;align-items:center;flex-wrap:wrap"><label style="margin:0;font-size:0.88rem;display:flex;align-items:center;gap:6px">Update Status:<select [(ngModel)]="inquiryDetailStatus" style="padding:4px 8px;font-size:0.88rem"><option value="PENDING">PENDING</option><option value="CONTACTED">CONTACTED (In Progress)</option><option value="RESOLVED">RESOLVED</option><option value="REJECTED">REJECTED (Unverified / Invalid)</option><option value="CLOSED">CLOSED</option></select></label><button type="button" class="primary" [disabled]="saving()" (click)="saveInquiryResolution()">{{saving()?'Saving…':'💾 Save & Sync Update to Customer'}}</button></div></div><div class="form-actions" style="margin-top:12px"><button type="button" class="secondary" (click)="closeModal()">Close</button></div></div>}


  @if(modal()!.type==='blog'){<form (ngSubmit)="saveBlog()" class="form-grid"><label class="full">Article Title<input name="blogTitle" [(ngModel)]="blogDraft.title" (input)="autoGenerateSlug()" required placeholder="e.g. How to Bleed a Radiator"></label><label>Slug<input name="blogSlug" [(ngModel)]="blogDraft.slug" required placeholder="e.g. how-to-bleed-a-radiator"></label><label>Category<input name="blogCategory" [(ngModel)]="blogDraft.category" required placeholder="e.g. Buying Guides, Radiators & Heating"></label><label>Author<input name="blogAuthor" [(ngModel)]="blogDraft.author" required placeholder="e.g. THP Heating Specialist"></label><label>Read Time (Minutes)<input name="blogReadTime" type="number" min="1" [(ngModel)]="blogDraft.readTimeMinutes"></label><label>Publication Date<input name="blogDate" [(ngModel)]="blogDraft.publishedAt" placeholder="e.g. 15 Oct 2026"></label><label>Status<select name="blogStatus" [(ngModel)]="blogDraft.status"><option value="PUBLISHED">PUBLISHED (Visible & Synced)</option><option value="DRAFT">DRAFT (Admin Only)</option></select></label><label class="full">Cover Image URL<input name="blogCover" type="url" [(ngModel)]="blogDraft.coverImage" placeholder="https://example.com/image.jpg"></label><label class="full">Excerpt Summary<textarea name="blogExcerpt" rows="3" [(ngModel)]="blogDraft.excerpt" placeholder="Brief summary of the article for listings..."></textarea></label><label class="full">Tags (comma-separated)<input name="blogTags" [(ngModel)]="blogDraft.tags" placeholder="e.g. Radiators, BTU, Heating Advice"></label><label class="full">HTML Content Body<textarea name="blogContent" rows="12" [(ngModel)]="blogDraft.content" required placeholder="Full HTML article content..." style="font-family:monospace;font-size:0.85rem"></textarea></label><div class="form-actions full"><button type="button" class="secondary" (click)="closeModal()">Cancel</button><button type="submit" class="primary" [disabled]="savingBlog()">{{savingBlog()?'Saving…':'💾 Save & Sync Article'}}</button></div></form>}

  @if(modal()!.type==='banner'){<form (ngSubmit)="saveBanner()" class="form-grid">@if(bannerDraft.imageUrl){<div class="product-edit-preview full" style="display:flex;align-items:center;gap:16px;background:#f8fafc;padding:12px 16px;border-radius:8px;border:1px solid #e2e8f0"><img [src]="bannerDraft.imageUrl" [alt]="bannerDraft.title" style="width:120px;height:70px;object-fit:cover;border-radius:6px;border:1px solid #cbd5e1"><div style="flex:1"><strong style="font-size:0.92rem;display:block">Banner Image Preview</strong><small class="muted" style="word-break:break-all">{{bannerDraft.imageUrl}}</small></div><button type="button" class="secondary" (click)="cropExistingBanner()" style="padding:6px 12px;font-size:0.8rem">✂ Recrop Image</button><button type="button" class="delete-btn" (click)="bannerDraft.imageUrl=''" style="padding:6px 12px;font-size:0.8rem">✕ Remove</button></div>}<label class="full">Banner Section / Placement *<select name="btype" [(ngModel)]="bannerDraft.type"><option value="BANNER">Top Hero Slider Banner</option><option value="CAMPAIGN_BANNER">Second Campaign Banner (Dual Cards)</option></select></label><label class="full">Eyebrow Tag (Kicker)<input name="btag" [(ngModel)]="bannerDraft.tag" placeholder="e.g. ✦ BRITISH HEATING & LUXURY BATHROOMS · 2026 or DESIGN-LED HEATING"></label><label class="full">Banner Headline (Title) *<input name="btitle" [(ngModel)]="bannerDraft.title" required placeholder="e.g. Designer Radiators or Luxury Heating Built for Considered Homes."></label><label class="full">Subtitle / Body Description<textarea name="bbody" rows="3" [(ngModel)]="bannerDraft.body" placeholder="e.g. Architectural warmth in statement finishes with superior heat outputs..."></textarea></label><label>Primary Button Text<input name="bbtnText" [(ngModel)]="bannerDraft.buttonText" placeholder="e.g. Shop Collection → or Explore Heating Range →"></label><label>Target Link / Section Anchor<input name="blinkUrl" [(ngModel)]="bannerDraft.linkUrl" placeholder="e.g. /category/Radiators or #new-arrivals"></label><label>Slide Order (Position)<input type="number" min="1" step="1" name="bsortOrder" [(ngModel)]="bannerDraft.sortOrder" placeholder="1"></label><label>Publication Status<select name="bstatus" [(ngModel)]="bannerDraft.status"><option value="PUBLISHED">PUBLISHED (Active on Storefront)</option><option value="DRAFT">DRAFT (Hidden from Storefront)</option></select></label><div class="full image-upload-field"><span>Banner Featured / Background Image</span><div style="display:flex;gap:10px;align-items:center;margin-top:6px;flex-wrap:wrap"><input name="bimgUrl" type="url" [(ngModel)]="bannerDraft.imageUrl" placeholder="https://... or pick from media" style="flex:1;min-width:200px"><input type="file" #bannerFileInput accept="image/jpeg,image/png,image/webp" (change)="onBannerFileSelected($event)" style="display:none"><button type="button" class="primary" (click)="bannerFileInput.click()" style="white-space:nowrap;padding:10px 14px;display:flex;align-items:center;gap:6px"><span>✂</span> Upload &amp; Crop Banner</button><button type="button" class="secondary" (click)="openMediaPicker('banner')" style="white-space:nowrap;padding:10px 14px">🖼 Pick Media</button></div></div><div class="form-actions full"><button type="button" class="secondary" (click)="closeModal()">Cancel</button><button type="submit" class="primary" [disabled]="savingBanner()">{{savingBanner()?'Saving & Syncing…':'💾 Save Banner & Sync'}}</button></div></form>}

  @if(modal()!.type==='navMenu'){
    <form (ngSubmit)="saveNavMenu()" style="display:flex;flex-direction:column;gap:18px">
      <!-- TAB NAVIGATION -->
      <div style="display:flex;gap:8px;border-bottom:1px solid #e2e8f0;padding-bottom:10px;flex-wrap:wrap">
        <button type="button" class="tab-btn" [class.active]="navMenuDraftTab==='general'" (click)="navMenuDraftTab='general'">1. Department & Icon</button>
        <button type="button" class="tab-btn" [class.active]="navMenuDraftTab==='filters'" (click)="navMenuDraftTab='filters'">2. Dynamic Filters for this Menu</button>
        <button type="button" class="tab-btn" [class.active]="navMenuDraftTab==='columns'" (click)="navMenuDraftTab='columns'">3. Submenu Columns & Links ({{navMenuDraft.columns?.length||0}})</button>
        <button type="button" class="tab-btn" [class.active]="navMenuDraftTab==='promo'" (click)="navMenuDraftTab='promo'">4. Mega-Menu Promo Card</button>
      </div>

      <!-- TAB 1: GENERAL & CATEGORY IMAGE -->
      @if(navMenuDraftTab === 'general'){
        <div class="form-grid">
          @if(navMenuDraft.imageUrl){
            <div class="product-edit-preview full" style="display:flex;align-items:center;gap:16px;background:#f8fafc;padding:12px 16px;border-radius:8px;border:1px solid #e2e8f0">
              <img [src]="navMenuDraft.imageUrl" [alt]="navMenuDraft.title" style="width:120px;height:75px;object-fit:cover;border-radius:6px;border:1px solid #cbd5e1">
              <div style="flex:1">
                <strong style="font-size:0.92rem;display:block;color:#0f172a">Category Featured Image Preview</strong>
                <small class="muted" style="word-break:break-all">{{navMenuDraft.imageUrl}}</small>
              </div>
              <button type="button" class="secondary" (click)="cropExistingNavImage()" style="padding:6px 12px;font-size:0.8rem">✂ Recrop</button>
              <button type="button" class="delete-btn" (click)="navMenuDraft.imageUrl=''" style="padding:6px 12px;font-size:0.8rem">✕ Remove</button>
            </div>
          }
          <div class="full image-upload-field">
            <span style="font-size:0.84rem;font-weight:600;color:#334155;display:block;margin-bottom:4px">Category Featured / Department Banner Image</span>
            <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
              <input name="nmImgUrl" type="url" [(ngModel)]="navMenuDraft.imageUrl" placeholder="https://... or pick from media" style="flex:1;min-width:200px">
              <input type="file" #navFileInput accept="image/jpeg,image/png,image/webp" (change)="onNavCategoryFileSelected($event)" style="display:none">
              <button type="button" class="primary" (click)="navFileInput.click()" style="white-space:nowrap;padding:10px 14px;display:flex;align-items:center;gap:6px">
                <span>✂</span> Upload &amp; Crop Image
              </button>
              <button type="button" class="secondary" (click)="openMediaPicker('navCategory', null, navMenuDraft.category)" style="white-space:nowrap;padding:10px 14px;display:flex;align-items:center;gap:6px">
                <span>🖼</span> Pick Image
              </button>
            </div>
            <small class="muted" style="display:block;margin-top:4px">Used as department header visual and category card thumbnail across storefront.</small>
          </div>

          <label>Menu Title *<input name="nmTitle" [(ngModel)]="navMenuDraft.title" required placeholder="e.g. Bathroom Suites"></label>
          <label>Mapped Product Category *<input name="nmCategory" [(ngModel)]="navMenuDraft.category" required placeholder="e.g. Bathrooms"></label>
          <label>Department Icon (Emoji / Symbol)<input name="nmIcon" [(ngModel)]="navMenuDraft.icon" placeholder="e.g. 🛁, 🔥, ⚡, ⚙"></label>
          <label>Kicker Badge (Optional)<input name="nmBadge" [(ngModel)]="navMenuDraft.badge" placeholder="e.g. HOT, NEW, SALE"></label>
          <label>Menu ID (Slug)<input name="nmId" [(ngModel)]="navMenuDraft.menuId" placeholder="e.g. bathroom-suites"></label>
          <label>Sort Position Order<input name="nmSort" type="number" min="1" [(ngModel)]="navMenuDraft.sortOrder"></label>
          <label class="full">Status<select name="nmStatus" [(ngModel)]="navMenuDraft.status"><option value="PUBLISHED">PUBLISHED (Visible in Storefront Header)</option><option value="DRAFT">DRAFT (Hidden)</option></select></label>
          <label class="full">Department Description (Introductory Copy)<textarea name="nmDesc" rows="3" [(ngModel)]="navMenuDraft.description" placeholder="Transform your bathroom with luxury heated towel warmers..."></textarea></label>
        </div>
      }

      <!-- TAB 2: DYNAMIC FILTERS & VISUAL SUBCATEGORIES -->
      @if(navMenuDraftTab === 'filters'){
        <div style="display:flex;flex-direction:column;gap:20px">
          <div style="background:linear-gradient(135deg,#eff6ff 0%,#f0fdf4 100%);border:1px solid #bfdbfe;border-radius:10px;padding:16px;color:#1e40af">
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:4px">
              <span style="font-size:1.3rem">🎯</span>
              <strong style="font-size:0.95rem;color:#1e3a8a">Per-Department Dynamic Storefront Filtering</strong>
            </div>
            <p style="margin:0;font-size:0.84rem;line-height:1.5;color:#334155">
              Customize which sidebar filter cards and visual subcategory pills appear when customers browse <strong>{{navMenuDraft.title || 'this department'}}</strong>. Radiator-specific filters (like Convector Panel Types DF/SF and BTU) can be turned off for Bathroom or Valve departments, keeping customer filtering clean and relevant.
            </p>
          </div>

          <!-- SECTION 1: BUILT-IN DYNAMIC FILTER TOGGLES -->
          <div style="background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:18px">
            <div style="margin-bottom:14px">
              <strong style="font-size:0.94rem;color:#0f172a;display:block">Standard Filter Modules</strong>
              <small class="muted">Enable or disable specific filter cards for this department's storefront sidebar.</small>
            </div>

            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:12px">
              
              <!-- Price Filter Card -->
              <div class="filter-toggle-card" [class.enabled]="navMenuDraft.filterOptions.showPriceFilter" (click)="navMenuDraft.filterOptions.showPriceFilter = !navMenuDraft.filterOptions.showPriceFilter">
                <div style="display:flex;justify-content:space-between;align-items:center;width:100%">
                  <div style="display:flex;align-items:center;gap:10px">
                    <span class="filter-icon">💷</span>
                    <div>
                      <strong style="font-size:0.88rem;display:block;color:#0f172a">Price Range</strong>
                      <small class="muted" style="font-size:0.75rem">Min/Max slider & price brackets</small>
                    </div>
                  </div>
                  <span class="filter-status-pill" [class.active]="navMenuDraft.filterOptions.showPriceFilter">
                    {{navMenuDraft.filterOptions.showPriceFilter ? 'Active' : 'Off'}}
                  </span>
                </div>
              </div>

              <!-- In-Stock Filter Card -->
              <div class="filter-toggle-card" [class.enabled]="navMenuDraft.filterOptions.showAvailabilityFilter" (click)="navMenuDraft.filterOptions.showAvailabilityFilter = !navMenuDraft.filterOptions.showAvailabilityFilter">
                <div style="display:flex;justify-content:space-between;align-items:center;width:100%">
                  <div style="display:flex;align-items:center;gap:10px">
                    <span class="filter-icon">📦</span>
                    <div>
                      <strong style="font-size:0.88rem;display:block;color:#0f172a">In-Stock Only</strong>
                      <small class="muted" style="font-size:0.75rem">Ready to dispatch filter</small>
                    </div>
                  </div>
                  <span class="filter-status-pill" [class.active]="navMenuDraft.filterOptions.showAvailabilityFilter">
                    {{navMenuDraft.filterOptions.showAvailabilityFilter ? 'Active' : 'Off'}}
                  </span>
                </div>
              </div>

              <!-- Brand Filter Card -->
              <div class="filter-toggle-card" [class.enabled]="navMenuDraft.filterOptions.showBrandFilter" (click)="navMenuDraft.filterOptions.showBrandFilter = !navMenuDraft.filterOptions.showBrandFilter">
                <div style="display:flex;justify-content:space-between;align-items:center;width:100%">
                  <div style="display:flex;align-items:center;gap:10px">
                    <span class="filter-icon">🏷️</span>
                    <div>
                      <strong style="font-size:0.88rem;display:block;color:#0f172a">Brand / Manufacturer</strong>
                      <small class="muted" style="font-size:0.75rem">Terma, Hearth, Reina, etc.</small>
                    </div>
                  </div>
                  <span class="filter-status-pill" [class.active]="navMenuDraft.filterOptions.showBrandFilter">
                    {{navMenuDraft.filterOptions.showBrandFilter ? 'Active' : 'Off'}}
                  </span>
                </div>
              </div>

              <!-- Colour Filter Card -->
              <div class="filter-toggle-card" [class.enabled]="navMenuDraft.filterOptions.showColourFilter" (click)="navMenuDraft.filterOptions.showColourFilter = !navMenuDraft.filterOptions.showColourFilter">
                <div style="display:flex;justify-content:space-between;align-items:center;width:100%">
                  <div style="display:flex;align-items:center;gap:10px">
                    <span class="filter-icon">🎨</span>
                    <div>
                      <strong style="font-size:0.88rem;display:block;color:#0f172a">Colour Swatches</strong>
                      <small class="muted" style="font-size:0.75rem">Chrome, White, Black, Anthracite</small>
                    </div>
                  </div>
                  <span class="filter-status-pill" [class.active]="navMenuDraft.filterOptions.showColourFilter">
                    {{navMenuDraft.filterOptions.showColourFilter ? 'Active' : 'Off'}}
                  </span>
                </div>
              </div>

              <!-- BTU Filter Card -->
              <div class="filter-toggle-card" [class.enabled]="navMenuDraft.filterOptions.showBtuFilter" (click)="navMenuDraft.filterOptions.showBtuFilter = !navMenuDraft.filterOptions.showBtuFilter">
                <div style="display:flex;justify-content:space-between;align-items:center;width:100%">
                  <div style="display:flex;align-items:center;gap:10px">
                    <span class="filter-icon">🔥</span>
                    <div>
                      <strong style="font-size:0.88rem;display:block;color:#0f172a">Heat Output (BTU)</strong>
                      <small class="muted" style="font-size:0.75rem">Thermal wattage & BTU brackets</small>
                    </div>
                  </div>
                  <span class="filter-status-pill" [class.active]="navMenuDraft.filterOptions.showBtuFilter">
                    {{navMenuDraft.filterOptions.showBtuFilter ? 'Active' : 'Off'}}
                  </span>
                </div>
              </div>

              <!-- Convector Panel Type Filter Card -->
              <div class="filter-toggle-card" [class.enabled]="navMenuDraft.filterOptions.showPanelTypeFilter" (click)="navMenuDraft.filterOptions.showPanelTypeFilter = !navMenuDraft.filterOptions.showPanelTypeFilter">
                <div style="display:flex;justify-content:space-between;align-items:center;width:100%">
                  <div style="display:flex;align-items:center;gap:10px">
                    <span class="filter-icon">📐</span>
                    <div>
                      <strong style="font-size:0.88rem;display:block;color:#0f172a">Convector Panel Types</strong>
                      <small class="muted" style="font-size:0.75rem">DF (Type 22), SF (Type 11), TS</small>
                    </div>
                  </div>
                  <span class="filter-status-pill" [class.active]="navMenuDraft.filterOptions.showPanelTypeFilter">
                    {{navMenuDraft.filterOptions.showPanelTypeFilter ? 'Active' : 'Off'}}
                  </span>
                </div>
              </div>

              <!-- Height Sizing Filter Card -->
              <div class="filter-toggle-card" [class.enabled]="navMenuDraft.filterOptions.showHeightFilter" (click)="navMenuDraft.filterOptions.showHeightFilter = !navMenuDraft.filterOptions.showHeightFilter">
                <div style="display:flex;justify-content:space-between;align-items:center;width:100%">
                  <div style="display:flex;align-items:center;gap:10px">
                    <span class="filter-icon">📏</span>
                    <div>
                      <strong style="font-size:0.88rem;display:block;color:#0f172a">Height Sizing</strong>
                      <small class="muted" style="font-size:0.75rem">300mm to 1800mm dimensions</small>
                    </div>
                  </div>
                  <span class="filter-status-pill" [class.active]="navMenuDraft.filterOptions.showHeightFilter">
                    {{navMenuDraft.filterOptions.showHeightFilter ? 'Active' : 'Off'}}
                  </span>
                </div>
              </div>

              <!-- Fuel Type Filter Card -->
              <div class="filter-toggle-card" [class.enabled]="navMenuDraft.filterOptions.showFuelTypeFilter" (click)="navMenuDraft.filterOptions.showFuelTypeFilter = !navMenuDraft.filterOptions.showFuelTypeFilter">
                <div style="display:flex;justify-content:space-between;align-items:center;width:100%">
                  <div style="display:flex;align-items:center;gap:10px">
                    <span class="filter-icon">⚡</span>
                    <div>
                      <strong style="font-size:0.88rem;display:block;color:#0f172a">Fuel Type</strong>
                      <small class="muted" style="font-size:0.75rem">Central Heating, Electric, Dual Fuel</small>
                    </div>
                  </div>
                  <span class="filter-status-pill" [class.active]="navMenuDraft.filterOptions.showFuelTypeFilter">
                    {{navMenuDraft.filterOptions.showFuelTypeFilter ? 'Active' : 'Off'}}
                  </span>
                </div>
              </div>

            </div>
          </div>

          <!-- SECTION 2: DYNAMIC SUBCATEGORIES WITH IMAGES & MEDIA PICKER -->
          <div style="background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:18px">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;flex-wrap:wrap;gap:10px">
              <div>
                <div style="display:flex;align-items:center;gap:8px">
                  <span style="font-size:1.15rem">🖼️</span>
                  <strong style="font-size:0.95rem;color:#0f172a">Subcategories with Images & Media Picker</strong>
                  <span class="badge blue">{{navMenuDraft.filterOptions.subcategories?.length || 0}} Subcategories</span>
                </div>
                <small class="muted" style="display:block;margin-top:2px">
                  These appear as interactive visual cards with images above the product catalogue, and as filter options in the sidebar.
                </small>
              </div>
              <button type="button" class="primary" (click)="addSubcategoryItem()" style="padding:8px 14px;font-size:0.84rem;display:flex;align-items:center;gap:6px">
                <span>＋</span> Add Subcategory
              </button>
            </div>

            <!-- Subcategories Cards List -->
            <div style="display:flex;flex-direction:column;gap:12px">
              @for(sub of navMenuDraft.filterOptions.subcategories;track $index;let sIdx=$index){
                <div class="subcategory-edit-card">
                  
                  <!-- Left: Thumbnail Preview & Pick Media -->
                  <div style="display:flex;flex-direction:column;align-items:center;gap:6px;width:96px;flex-shrink:0">
                    <div style="width:72px;height:72px;border-radius:8px;border:1px solid #cbd5e1;background:#f8fafc;display:flex;align-items:center;justify-content:center;overflow:hidden;position:relative">
                      @if(sub.imageUrl){
                        <img [src]="sub.imageUrl" [alt]="sub.label || 'Subcategory'" (error)="onImgError($event)" style="width:100%;height:100%;object-fit:cover">
                      }@else{
                        <span style="font-size:1.8rem;color:#94a3b8">🖼️</span>
                      }
                    </div>
                    <button type="button" class="secondary" (click)="openMediaPicker('subcategory', sub, navMenuDraft.category)" style="font-size:0.74rem;padding:4px 8px;width:100%;white-space:nowrap;display:flex;align-items:center;justify-content:center;gap:4px">
                      <span>🖼</span> Pick Image
                    </button>
                  </div>

                  <!-- Middle & Right: Inputs Grid -->
                  <div style="flex:1;display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:10px;align-items:center">
                    
                    <label style="margin:0">
                      <span style="font-size:0.78rem;font-weight:600;color:#475569;display:block;margin-bottom:2px">Subcategory Label *</span>
                      <input [(ngModel)]="sub.label" [name]="'sub_lbl_'+sIdx" placeholder="e.g. Type 22 Double Convector (DF)" style="font-size:0.85rem;padding:7px 10px;width:100%">
                    </label>

                    <label style="margin:0">
                      <span style="font-size:0.78rem;font-weight:600;color:#475569;display:block;margin-bottom:2px">Search / Filter Tag *</span>
                      <input [(ngModel)]="sub.query" [name]="'sub_qry_'+sIdx" placeholder="e.g. DF, Colorado, Corner" style="font-size:0.85rem;padding:7px 10px;width:100%">
                    </label>

                    <label style="margin:0">
                      <span style="font-size:0.78rem;font-weight:600;color:#475569;display:block;margin-bottom:2px">Badge (Optional)</span>
                      <input [(ngModel)]="sub.badge" [name]="'sub_bdg_'+sIdx" placeholder="e.g. BESTSELLER, SAVE 20%" style="font-size:0.85rem;padding:7px 10px;width:100%">
                    </label>

                    <label style="margin:0">
                      <span style="font-size:0.78rem;font-weight:600;color:#475569;display:block;margin-bottom:2px">Image URL</span>
                      <input [(ngModel)]="sub.imageUrl" [name]="'sub_img_'+sIdx" placeholder="https://... or click Pick" style="font-size:0.85rem;padding:7px 10px;width:100%">
                    </label>

                  </div>

                  <!-- Delete Button -->
                  <button type="button" class="delete-btn" (click)="removeSubcategoryItem(sIdx)" style="padding:8px 10px;align-self:center;margin:0" title="Remove Subcategory">
                    ✕
                  </button>

                </div>
              }@empty{
                <div style="text-align:center;padding:28px 16px;background:#f8fafc;border:2px dashed #cbd5e1;border-radius:8px;color:#64748b">
                  <span style="font-size:2rem;display:block;margin-bottom:6px">📁</span>
                  <strong style="font-size:0.92rem;display:block;color:#334155">No subcategories defined for this menu</strong>
                  <p style="margin:4px 0 12px;font-size:0.82rem">Add subcategories with thumbnail images so customers can quickly browse types and styles with visual cards.</p>
                  <button type="button" class="secondary" (click)="addSubcategoryItem()" style="padding:6px 14px;font-size:0.84rem">＋ Add First Subcategory</button>
                </div>
              }
            </div>
          </div>

          <!-- SECTION 3: CUSTOM DYNAMIC FILTER ATTRIBUTES -->
          <div style="background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:18px">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;flex-wrap:wrap;gap:10px">
              <div>
                <div style="display:flex;align-items:center;gap:8px">
                  <span style="font-size:1.15rem">⚙️</span>
                  <strong style="font-size:0.95rem;color:#0f172a">Dynamic Custom Filter Groups</strong>
                </div>
                <small class="muted">Add specialized filter groups (e.g. Orientation, Valve Style, Material) with selectable facet choices.</small>
              </div>
              <button type="button" class="secondary" (click)="addCustomFilterGroup()" style="padding:6px 12px;font-size:0.82rem">＋ Add Custom Filter Group</button>
            </div>

            <div style="display:flex;flex-direction:column;gap:10px">
              @for(cfg of navMenuDraft.filterOptions.customFilters;track $index;let cIdx=$index){
                <div style="display:grid;grid-template-columns:1fr 2fr auto;gap:10px;align-items:center;background:#f8fafc;padding:10px 14px;border-radius:8px;border:1px solid #e2e8f0">
                  <label style="margin:0">
                    <span style="font-size:0.75rem;font-weight:600;color:#475569;display:block">Filter Name</span>
                    <input [(ngModel)]="cfg.name" [name]="'cfg_name_'+cIdx" placeholder="e.g. Orientation or Material" style="font-size:0.84rem;padding:6px 10px;width:100%">
                  </label>
                  <label style="margin:0">
                    <span style="font-size:0.75rem;font-weight:600;color:#475569;display:block">Options (comma separated)</span>
                    <input [(ngModel)]="cfg.optionsStr" [name]="'cfg_opt_'+cIdx" placeholder="e.g. Horizontal, Vertical or Mild Steel, Aluminium" style="font-size:0.84rem;padding:6px 10px;width:100%">
                  </label>
                  <button type="button" class="delete-btn" (click)="removeCustomFilterGroup(cIdx)" style="padding:6px 10px;margin-top:14px" title="Remove Filter Group">✕</button>
                </div>
              }@empty{
                <small class="muted" style="font-style:italic">No custom dynamic filter groups added. (Optional: Click "＋ Add Custom Filter Group" if this category requires specialized product facets).</small>
              }
            </div>
          </div>

        </div>
      }

      <!-- TAB 3: SUBMENU COLUMNS & LINKS -->
      @if(navMenuDraftTab === 'columns'){
        <div style="display:flex;flex-direction:column;gap:16px">
          <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
            <div>
              <strong style="font-size:0.95rem;color:#0f172a">Mega-Menu Dropdown Columns</strong>
              <small class="muted" style="display:block">Columns and links rendered inside the storefront mega dropdown menu.</small>
            </div>
            <button type="button" class="secondary" (click)="addColumn()">＋ Add New Column</button>
          </div>

          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:16px">
            @for(col of navMenuDraft.columns;track $index;let cIdx=$index){
              <div style="background:#f8fafc;border:1px solid #cbd5e1;border-radius:8px;padding:14px;display:flex;flex-direction:column;gap:10px">
                <div style="display:flex;justify-content:space-between;align-items:center;gap:8px">
                  <input [(ngModel)]="col.title" [name]="'col_title_'+cIdx" placeholder="Column Title (e.g. Ladder & Bathroom Rails)" style="font-weight:700;font-size:0.9rem;padding:6px 10px;flex:1">
                  <button type="button" class="delete-btn" (click)="removeColumn(cIdx)" style="padding:4px 8px;font-size:0.75rem" title="Remove Column">✕</button>
                </div>

                <div style="display:flex;flex-direction:column;gap:6px">
                  @for(item of col.items;track $index;let iIdx=$index){
                    <div style="display:grid;grid-template-columns:1.2fr 1fr 70px auto;gap:6px;align-items:center;background:#fff;padding:6px 8px;border-radius:4px;border:1px solid #e2e8f0">
                      <input [(ngModel)]="item.label" [name]="'item_lbl_'+cIdx+'_'+iIdx" placeholder="Link Label" style="font-size:0.8rem;padding:4px 6px">
                      <input [(ngModel)]="item.query" [name]="'item_qry_'+cIdx+'_'+iIdx" placeholder="Query or Category" style="font-size:0.8rem;padding:4px 6px">
                      <input [(ngModel)]="item.badge" [name]="'item_bdg_'+cIdx+'_'+iIdx" placeholder="Badge" style="font-size:0.75rem;padding:4px 6px">
                      <button type="button" class="delete-btn" (click)="removeColumnItem(cIdx, iIdx)" style="padding:2px 6px;font-size:0.75rem;margin:0">✕</button>
                    </div>
                  }
                </div>

                <button type="button" class="secondary" (click)="addColumnItem(cIdx)" style="font-size:0.78rem;padding:4px 8px;margin-top:4px">＋ Add Link</button>
              </div>
            }@empty{
              <div class="empty-state" style="padding:24px">No mega-menu columns added yet. Click "＋ Add New Column".</div>
            }
          </div>
        </div>
      }

      <!-- TAB 4: MEGA-MENU FEATURED PROMO CARD -->
      @if(navMenuDraftTab === 'promo'){
        <div class="form-grid">
          @if(navMenuDraft.featuredPromo?.imageUrl){
            <div class="product-edit-preview full" style="display:flex;align-items:center;gap:16px;background:#f8fafc;padding:12px 16px;border-radius:8px;border:1px solid #e2e8f0">
              <img [src]="navMenuDraft.featuredPromo.imageUrl" [alt]="navMenuDraft.featuredPromo.title" (error)="onImgError($event)" style="width:120px;height:70px;object-fit:cover;border-radius:6px;border:1px solid #cbd5e1">
              <div>
                <strong style="font-size:0.92rem;display:block">Promo Image Preview</strong>
                <small class="muted" style="word-break:break-all">{{navMenuDraft.featuredPromo.imageUrl}}</small>
              </div>
            </div>
          }
          <label class="full">Promo Eyebrow Tag<input name="pTag" [(ngModel)]="navMenuDraft.featuredPromo.tag" placeholder="e.g. LUXURY BATHROOM HEATING"></label>
          <label class="full">Promo Headline Title<input name="pTitle" [(ngModel)]="navMenuDraft.featuredPromo.title" placeholder="e.g. Alex Multi-Rail Towel Warmer"></label>
          <label class="full">Subtitle / Promo Copy<textarea name="pSub" rows="2" [(ngModel)]="navMenuDraft.featuredPromo.subtitle" placeholder="Engineered for rapid towel drying, high thermal output..."></textarea></label>
          <label>Button CTA Text<input name="pCta" [(ngModel)]="navMenuDraft.featuredPromo.cta" placeholder="e.g. Explore Towel Warmers →"></label>
          <label>Target Query / Category<input name="pQry" [(ngModel)]="navMenuDraft.featuredPromo.query" placeholder="e.g. Alex or Bathrooms"></label>
          <div class="full image-upload-field">
            <span>Featured Promo Image</span>
            <div style="display:flex;gap:10px;align-items:center;margin-top:6px">
              <input name="pImg" type="url" [(ngModel)]="navMenuDraft.featuredPromo.imageUrl" placeholder="https://... or pick from media" style="flex:1">
              <button type="button" class="secondary" (click)="openMediaPicker('navPromo', null, navMenuDraft.category)" style="white-space:nowrap;padding:10px 14px;display:flex;align-items:center;gap:6px"><span>🖼</span> Pick Image</button>
            </div>
          </div>
        </div>
      }

      <!-- MODAL ACTIONS -->
      <div class="form-actions full" style="display:flex;justify-content:flex-end;gap:10px;margin-top:16px;border-top:1px solid #e2e8f0;padding-top:14px">
        <button type="button" class="secondary" (click)="closeModal()">Cancel</button>
        <button type="submit" class="primary" [disabled]="savingNavMenu()">{{savingNavMenu()?'Saving & Syncing…':'💾 Save Navigation Menu & Sync'}}</button>
      </div>
    </form>
  }

 </section></div>}

@if(cropModalActive()){
<div class="modal-backdrop" style="z-index:2200" (click)="closeCropModal()">
  <section class="modal" style="max-width:960px;width:95%;z-index:2201" (click)="$event.stopPropagation()">
    <header>
      <div>
        <p class="eyebrow">IMAGE FRAMING &amp; OPTIMIZATION</p>
        <h2>✂ Crop &amp; Adjust {{cropTargetType === 'banner' ? 'Banner' : 'Category'}} Image</h2>
      </div>
      <button type="button" (click)="closeCropModal()">×</button>
    </header>
    <div style="padding:18px 24px;display:flex;flex-direction:column;gap:16px">
      <!-- Aspect Ratio Presets -->
      <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
        <span style="font-size:0.82rem;font-weight:700;color:#334155">Aspect Ratio:</span>
        <button type="button" class="tab-btn" [class.active]="cropAspectRatio==='16:6'" (click)="setCropAspectRatio('16:6')">
          Hero Slider (16:6 / 1920×720)
        </button>
        <button type="button" class="tab-btn" [class.active]="cropAspectRatio==='16:7'" (click)="setCropAspectRatio('16:7')">
          Hero Slider (16:7 / 1920×840)
        </button>
        <button type="button" class="tab-btn" [class.active]="cropAspectRatio==='16:9'" (click)="setCropAspectRatio('16:9')">
          Campaign Card (16:9 / 1200×675)
        </button>
        <button type="button" class="tab-btn" [class.active]="cropAspectRatio==='21:9'" (click)="setCropAspectRatio('21:9')">
          Ultra-Wide (21:9 / 1920×820)
        </button>
      </div>

      <!-- Crop Viewport Container with Guidelines & Pan/Drag -->
      <div 
        id="banner-crop-viewport"
        (mousedown)="onCropMouseDown($event)"
        (mousemove)="onCropMouseMove($event)"
        (mouseup)="onCropMouseUp()"
        (mouseleave)="onCropMouseUp()"
        [style.aspectRatio]="getCssAspectRatio()"
        style="width:100%;max-height:460px;background:#0f172a;border:2px dashed #0284c7;border-radius:8px;position:relative;overflow:hidden;display:flex;align-items:center;justify-content:center;cursor:grab;user-select:none;box-shadow:inset 0 0 20px rgba(0,0,0,0.5)">
        
        <!-- Image being cropped -->
        <img 
          [src]="cropImageSrc" 
          [style.transform]="'translate(' + cropPanX + 'px, ' + cropPanY + 'px) scale(' + cropZoom + ')'"
          style="max-width:100%;max-height:100%;object-fit:contain;pointer-events:none;transform-origin:center center;transition:none">

        <!-- Rule of Thirds Grid Overlay -->
        <div style="position:absolute;inset:0;pointer-events:none;display:grid;grid-template-columns:1fr 1fr 1fr;grid-template-rows:1fr 1fr 1fr;border:1px solid rgba(255,255,255,0.25)">
          <div style="border-right:1px dashed rgba(255,255,255,0.3);border-bottom:1px dashed rgba(255,255,255,0.3)"></div>
          <div style="border-right:1px dashed rgba(255,255,255,0.3);border-bottom:1px dashed rgba(255,255,255,0.3)"></div>
          <div style="border-bottom:1px dashed rgba(255,255,255,0.3)"></div>
          <div style="border-right:1px dashed rgba(255,255,255,0.3);border-bottom:1px dashed rgba(255,255,255,0.3)"></div>
          <div style="border-right:1px dashed rgba(255,255,255,0.3);border-bottom:1px dashed rgba(255,255,255,0.3)"></div>
          <div style="border-bottom:1px dashed rgba(255,255,255,0.3)"></div>
          <div style="border-right:1px dashed rgba(255,255,255,0.3)"></div>
          <div style="border-right:1px dashed rgba(255,255,255,0.3)"></div>
          <div></div>
        </div>

        <!-- Drag instruction tag -->
        <div style="position:absolute;bottom:10px;left:12px;background:rgba(15,23,42,0.75);color:#fff;font-size:0.75rem;padding:4px 10px;border-radius:4px;pointer-events:none;backdrop-filter:blur(4px)">
          ✋ Drag image to position · Use slider below to zoom
        </div>
      </div>

      <!-- Controls: Zoom Slider and Reset -->
      <div style="display:flex;align-items:center;justify-content:space-between;gap:16px;background:#f8fafc;padding:12px 18px;border-radius:8px;border:1px solid #e2e8f0;flex-wrap:wrap">
        <div style="display:flex;align-items:center;gap:12px;flex:1;min-width:240px">
          <span style="font-size:0.82rem;font-weight:700;color:#334155;white-space:nowrap">🔍 Zoom ({{cropZoom | number:'1.2-2'}}x):</span>
          <input type="range" min="1.0" max="3.0" step="0.05" [(ngModel)]="cropZoom" style="flex:1;cursor:pointer">
        </div>
        <button type="button" class="secondary" (click)="resetCropTransform()" style="padding:6px 14px;font-size:0.8rem">
          ↺ Reset Framing
        </button>
      </div>

      <!-- Footer Buttons -->
      <div class="form-actions" style="margin:0;display:flex;justify-content:flex-end;gap:10px">
        <button type="button" class="secondary" (click)="closeCropModal()">Cancel</button>
        <button type="button" class="primary" [disabled]="croppingImage()" (click)="applyCropAndUpload()" style="display:flex;align-items:center;gap:6px">
          <span>{{croppingImage() ? '⏳ Cropping & Uploading…' : '✓ Apply Crop & Save Image'}}</span>
        </button>
      </div>
    </div>
  </section>
</div>
}
@if(mediaPickerActive()){
<div class="modal-backdrop" style="z-index:2000" (click)="closeMediaPicker()">
  <section class="modal" style="max-width:880px;width:92%;z-index:2001" (click)="$event.stopPropagation()">
    <header>
      <div>
        <p class="eyebrow">IMAGE LIBRARY</p>
        <h2>Select Media Image</h2>
      </div>
      <button type="button" (click)="closeMediaPicker()">×</button>
    </header>
    <div style="padding:18px 24px">
      @if(mediaPickerCategory){
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px;background:#f8fafc;padding:10px 14px;border-radius:8px;border:1px solid #e2e8f0;flex-wrap:wrap">
          <span style="font-size:0.82rem;font-weight:600;color:#334155">Filter Mode:</span>
          <button type="button" 
            [style.background]="mediaPickerCategoryFilter() === 'CURRENT' ? '#E47716' : '#fff'" 
            [style.color]="mediaPickerCategoryFilter() === 'CURRENT' ? '#fff' : '#334155'"
            [style.borderColor]="mediaPickerCategoryFilter() === 'CURRENT' ? '#E47716' : '#cbd5e1'"
            style="border:1px solid;border-radius:6px;padding:5px 12px;font-size:0.8rem;font-weight:600;cursor:pointer;display:inline-flex;align-items:center;gap:5px;transition:0.15s"
            (click)="mediaPickerCategoryFilter.set('CURRENT')">
            📁 {{mediaPickerCategory}} Images Only (Filtered)
          </button>
          <button type="button" 
            [style.background]="mediaPickerCategoryFilter() === 'ALL' ? '#E47716' : '#fff'" 
            [style.color]="mediaPickerCategoryFilter() === 'ALL' ? '#fff' : '#334155'"
            [style.borderColor]="mediaPickerCategoryFilter() === 'ALL' ? '#E47716' : '#cbd5e1'"
            style="border:1px solid;border-radius:6px;padding:5px 12px;font-size:0.8rem;font-weight:600;cursor:pointer;display:inline-flex;align-items:center;gap:5px;transition:0.15s"
            (click)="mediaPickerCategoryFilter.set('ALL')">
            🌐 Show All Images
          </button>
        </div>
      }
      <div style="display:flex;gap:10px;margin-bottom:12px;align-items:center;flex-wrap:wrap">
        <input type="text" [(ngModel)]="mediaPickerSearch" placeholder="Filter by filename, product name, or SKU..." style="flex:1;min-width:200px;padding:8px 12px;font-size:0.88rem;border:1px solid #cbd5e1;border-radius:6px">
        <button type="button" class="secondary" (click)="loadMediaGallery()" [disabled]="loadingMedia()" style="padding:8px 14px;font-size:0.84rem;cursor:pointer;display:inline-flex;align-items:center;gap:6px">
          <span>{{loadingMedia() ? '⏳ Refreshing…' : '↻ Refresh'}}</span>
        </button>
        <label class="primary" style="margin:0;padding:8px 14px;font-size:0.84rem;cursor:pointer;display:inline-flex;align-items:center;gap:6px;border-radius:6px;background:#E47716;color:#fff;font-weight:600">
          <input type="file" accept="image/*" (change)="uploadMediaPickerImage($event)" style="display:none" [disabled]="uploadingPickerImage()">
          <span>{{uploadingPickerImage() ? '⏳ Uploading…' : (mediaPickerCategory ? '＋ Upload to ' + mediaPickerCategory : '＋ Upload New Image')}}</span>
        </label>
      </div>
      <p class="muted" style="margin-bottom:12px;font-size:0.84rem">
        @if(mediaPickerCategory && mediaPickerCategoryFilter() === 'CURRENT'){
          Showing <strong>{{allMediaPickerImages().length}}</strong> images uploaded so far for <strong>{{mediaPickerCategory}}</strong>. Click any image to assign it directly, or click <strong>＋ Upload to {{mediaPickerCategory}}</strong> to add a new file.
        }@else{
          Showing <strong>{{allMediaPickerImages().length}}</strong> assets from media library & product catalogue. Click any image to assign it directly.
        }
      </p>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(115px,1fr));gap:10px;max-height:420px;overflow-y:auto;padding:4px">
        @for(img of allMediaPickerImages();track img.url){
          <button type="button" (click)="applyMediaPicker(img.url)" style="position:relative;border:1px solid #cbd5e1;background:#f8fafc;border-radius:6px;padding:6px;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:4px;transition:0.15s" title="{{img.filename}}">
            @if(img.isNew) {
              <span style="position:absolute;top:4px;right:4px;background:#E47716;color:#fff;font-size:0.6rem;font-weight:800;padding:2px 5px;border-radius:3px;z-index:2;box-shadow:0 1px 3px rgba(0,0,0,0.25)">NEW</span>
            }
            <img [src]="img.url" (error)="onImgError($event)" style="width:96px;height:85px;object-fit:contain;background:#fff;border-radius:4px">
            <small style="font-size:0.7rem;max-width:96px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#334155">{{img.filename}}</small>
          </button>
        }@empty{
          <div style="grid-column:1/-1;text-align:center;padding:36px;color:#64748b;font-size:0.9rem">
            @if(mediaPickerCategory && mediaPickerCategoryFilter() === 'CURRENT'){
              No category images uploaded for <strong>{{mediaPickerCategory}}</strong> yet.
              <div style="margin-top:14px;display:flex;justify-content:center;gap:10px;flex-wrap:wrap">
                <label class="primary" style="margin:0;padding:8px 16px;font-size:0.84rem;cursor:pointer;display:inline-flex;align-items:center;gap:6px;border-radius:6px;background:#E47716;color:#fff;font-weight:600">
                  <input type="file" accept="image/*" (change)="uploadMediaPickerImage($event)" style="display:none" [disabled]="uploadingPickerImage()">
                  <span>＋ Upload First {{mediaPickerCategory}} Image</span>
                </label>
                <button type="button" class="secondary" (click)="mediaPickerCategoryFilter.set('ALL')" style="font-size:0.84rem">Show All Images</button>
              </div>
            }@else{
              No images found.
              <div style="margin-top:14px">
                <label class="primary" style="margin:0;padding:8px 16px;font-size:0.84rem;cursor:pointer;display:inline-flex;align-items:center;gap:6px;border-radius:6px;background:#E47716;color:#fff;font-weight:600">
                  <input type="file" accept="image/*" (change)="uploadMediaPickerImage($event)" style="display:none" [disabled]="uploadingPickerImage()">
                  <span>＋ Upload New Image</span>
                </label>
              </div>
            }
          </div>
        }
      </div>
      <div class="form-actions" style="margin-top:16px;display:flex;justify-content:flex-end">
        <button type="button" class="secondary" (click)="closeMediaPicker()">Cancel</button>
      </div>
    </div>
  </section>
</div>
}
@if(toast()){<div class="toast">✓ {{toast()}}</div>}
`})
class App {
 @ViewChild('globalSearchInput') globalSearchInput?:ElementRef<HTMLInputElement>;
  private http=inject(HttpClient);private sanitizer=inject(DomSanitizer);private searchTimer?:ReturnType<typeof setTimeout>; user=signal<User|null>(JSON.parse(sessionStorage.getItem('hearth_admin_user')||'null')); view=signal<View>('dashboard');navOpen=signal(false);loading=signal(false);saving=signal(false);uploadingImage=signal(false);uploadingPdf=signal(false);contentEditorTab:'editor'|'preview'='editor';inventorySearch='';onlyLowStock=false;importingProducts=signal(false);importingImages=signal(false);syncingAll=signal(false);syncingProductId=signal<number|null>(null);bulkImportMode=signal<'csv'|'excel'>('csv');parsedCsvProducts=signal<any[]>([]);csvRawFilename=signal('');csvAutoPublish=signal(true);uploadedMediaList=signal<any[]>([]);loadingMedia=signal(false);uploadingBulkImages=signal(false);bulkImageResults=signal<any[]>([]);mediaManagerTab=signal<'upload'|'zip'|'gallery'>('upload');selectedMediaUrl=signal('');assignTargetProductId:number|null=null;assigningImage=signal(false);allProductsList=signal<Product[]>([]);error=signal('');toast=signal('');dashboardData=signal<any>(null);imageCoverage=signal<any>(null);products=signal<Product[]>([]);productPage=signal(0);productTotalPages=signal(1);productTotalElements=signal(0);readonly productPageSize=10;customers=signal<any[]>([]);quotes=signal<any[]>([]);orders=signal<any[]>([]);promotions=signal<any[]>([]);inquiries=signal<any[]>([]);selectedInquiry=signal<any>(null);inquiryResolutionNote='';inquiryDetailStatus='CONTACTED';reviews=signal<any[]>([]);reviewFilter='';inquiryFilter='';inquirySearch='';orderDraft:any={};promoDraft:any={};promoMinBasket=0;inventory=signal<any[]>([]);contents=signal<any[]>([]);blogs=signal<AdminBlogPost[]>([]);loadingBlogs=signal(false);syncingAllBlogs=signal(false);savingBlog=signal(false);blogSearchQuery="";blogCategoryFilter="";blogStatusFilter="";blogDraft:AdminBlogPost=this.emptyBlog();audits=signal<any[]>([]);auditPage=signal(0);auditTotalPages=signal(1);auditTotalElements=signal(0);readonly auditPageSize=10;modal=signal<any>(null);searchOpen=signal(false);searching=signal(false);searchResults=signal<any[]>([]);notificationsOpen=signal(false);profileOpen=signal(false);unreadNotifications=signal(true);email='';password='';showPassword=false;globalSearch='';query='';productStatus='';productPrice=0;productCost=0;quoteSubtotal=0;quoteTax=0;selectedImageName='';
  productDraft:Product=this.emptyProduct();customerDraft:any={};quoteDraft:any={};
  brands = signal<any[]>([]); loadingBrands = signal<boolean>(false); savingQuote = signal<boolean>(false); sendingQuoteEmail = signal<boolean>(false);
  companyList = signal<any[]>([]); loadingCompanies = signal<boolean>(false); savingCompany = signal<boolean>(false);
  companyDraft: any = this.emptyCompany(); reviewDraft: any = this.emptyReview(); savingReview = signal<boolean>(false);
  productBrand: string = ''; mediaPickerActive = signal<boolean>(false); mediaPickerSearch: string = '';
  mediaPickerCategory: string = ''; mediaPickerCategoryFilter = signal<'CURRENT' | 'ALL'>('CURRENT');
  uploadingPickerImage = signal<boolean>(false);
  recentlyUploadedPickerImages = signal<any[]>([]);
  productDocuments: Array<{ title: string; url: string }> = []; uploadingDoc = signal<boolean>(false);
  banners = signal<any[]>([]); loadingBanners = signal<boolean>(false); savingBanner = signal<boolean>(false); syncingBanners = signal<boolean>(false);
  bannerSectionFilter: string = 'ALL';
  setBannerFilter(f: string) { this.bannerSectionFilter = f; }
  filteredBanners = computed(() => {
    const f = this.bannerSectionFilter;
    const list = this.banners();
    if (f === 'ALL') return list;
    return list.filter(b => (b.type || 'BANNER') === f);
  });
  bannerDraft: any = { id: null, type: 'BANNER', title: '', body: '', tag: '✦ BRITISH HEATING & LUXURY BATHROOMS · 2026', imageUrl: '', buttonText: 'Explore Heating Range →', linkUrl: '#new-arrivals', sortOrder: 1, status: 'PUBLISHED' };
  sendingCustomerNotification = signal<boolean>(false);
  assignProductSearch = signal<string>('');
  assignDropdownOpen = signal<boolean>(true);
  stockProductSearch = signal<string>('');
  private assignSearchTimer?: ReturnType<typeof setTimeout>;

  filteredProductsForAssign = computed(() => {
    const query = (this.assignProductSearch() || '').trim().toLowerCase();
    const list = this.allProductsList().length ? this.allProductsList() : this.products();
    if (!query) return list;
    return list.filter(p => {
      const nameMatch = (p.name || '').toLowerCase().includes(query);
      const skuMatch = (p.sku || '').toLowerCase().includes(query);
      const brandMatch = (p.brand || '').toLowerCase().includes(query);
      const catMatch = (p.category || '').toLowerCase().includes(query);
      const varMatch = (p.variants || []).some(v => 
        (v.variantSku || '').toLowerCase().includes(query) || 
        (v.ean || '').toLowerCase().includes(query)
      );
      return nameMatch || skuMatch || brandMatch || catMatch || varMatch;
    });
  });

  filteredStockProducts = computed(() => {
    const query = (this.stockProductSearch() || '').trim().toLowerCase();
    const list = this.allProductsList().length ? this.allProductsList() : this.products();
    if (!query) return list;
    return list.filter(p => {
      const nameMatch = (p.name || '').toLowerCase().includes(query);
      const skuMatch = (p.sku || '').toLowerCase().includes(query);
      const brandMatch = (p.brand || '').toLowerCase().includes(query);
      return nameMatch || skuMatch || brandMatch;
    });
  });

  quoteProductFilter = signal<string>('');
  quoteProductCatalogue = computed(() => {
    const query = (this.quoteProductFilter() || '').trim().toLowerCase();
    const list = this.allProductsList().length ? this.allProductsList() : this.products();
    if (!query) {
      return [...list].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    }
    return list.filter(p => {
      const nameMatch = (p.name || '').toLowerCase().includes(query);
      const skuMatch = (p.sku || '').toLowerCase().includes(query);
      const brandMatch = (p.brand || '').toLowerCase().includes(query);
      const varMatch = (p.variants || []).some(v =>
        (v.variantSku || '').toLowerCase().includes(query) ||
        (v.colour || '').toLowerCase().includes(query)
      );
      return nameMatch || skuMatch || brandMatch || varMatch;
    }).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  });

  getSelectedProductForAssign(): Product | null {
    if (!this.assignTargetProductId) return null;
    const list = this.allProductsList().length ? this.allProductsList() : this.products();
    return list.find(p => p.id === this.assignTargetProductId) || null;
  }

  openAssignForImage(img: any, event?: Event) {
    if (event) event.stopPropagation();
    this.selectedMediaUrl.set(img.url);
    this.assignProductSearch.set('');
    this.assignDropdownOpen.set(true);
    if (img.assignedSku) {
      const list = this.allProductsList().length ? this.allProductsList() : this.products();
      const found = list.find(p => p.sku === img.assignedSku || (p.variants || []).some(v => v.variantSku === img.assignedSku || v.ean === img.assignedSku));
      this.assignTargetProductId = found ? found.id || null : null;
    } else {
      this.assignTargetProductId = null;
    }
  }

  selectAssignProduct(prod: Product) {
    this.assignTargetProductId = prod.id || null;
    this.assignProductSearch.set('');
  }

  clearAssignSelection() {
    this.assignTargetProductId = null;
    this.assignProductSearch.set('');
    this.assignDropdownOpen.set(true);
  }

  onAssignSearchInput() {
    const query = this.assignProductSearch().trim();
    if (query.length >= 2) {
      if (this.assignSearchTimer) clearTimeout(this.assignSearchTimer);
      this.assignSearchTimer = setTimeout(() => {
        this.http.get<any>(`/api/products?q=${encodeURIComponent(query)}&size=50`).pipe(catchError(() => of({ content: [] }))).subscribe(r => {
          if (r?.content?.length) {
            const current = this.allProductsList();
            const currentIds = new Set(current.map(p => p.id));
            const toAdd = r.content.filter((p: any) => !currentIds.has(p.id));
            if (toAdd.length > 0) {
              this.allProductsList.set([...current, ...toAdd]);
            }
          }
        });
      }, 300);
    }
  }

  selectedQuoteDetails: any = null; selectedOrderForUpdate: any = null; selectedInquiryForUpdate: any = null;
  orderCustomerNote: string = ''; inquiryCustomerMessage: string = '';
  mediaPickerTarget: any = null;
  sampleMediaImages: any[] = [
    { filename: 'THP Logo', url: '/thp-logo.jpg' },
    { filename: 'Designer Radiator Anthracite', url: 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=800&q=80' },
    { filename: 'Modern Towel Rail Chrome', url: 'https://images.unsplash.com/photo-1507652313519-d4e9174996dd?auto=format&fit=crop&w=800&q=80' },
    { filename: 'Underfloor Heating Manifold', url: 'https://images.unsplash.com/photo-1621905252507-b35492cc74b4?auto=format&fit=crop&w=800&q=80' }
  ];contentDraft:any={id:null,title:'',slug:'',type:'PAGE',status:'PUBLISHED',seoTitle:'',body:'',pdfUrl:'',pdfFilename:''};stockDraft:any={type:'ADD',quantity:1,warehouse:'Main Warehouse',reason:''};
  nav: {label: string, items: {view: View, name: string, icon: string, badge?: string}[]}[] = [{label:'OVERVIEW',items:[{view:'dashboard' as View,name:'Dashboard',icon:'nav-dashboard'},{view:'reports' as View,name:'Reports & Analytics',icon:'nav-reports'}]},{label:'CATALOGUE',items:[{view:'products' as View,name:'Products',icon:'nav-products'},{view:'navigation' as View,name:'Navigation & Filters',icon:'nav-content'},{view:'companies' as View,name:'Brands & Companies',icon:'nav-inventory'},{view:'inventory' as View,name:'Inventory Positions',icon:'nav-inventory'},{view:'banners' as View,name:'Banners & Campaigns',icon:'nav-banners'},{view:'content' as View,name:'Static Content & Guides',icon:'nav-content'},{view:'blogs' as View,name:'Blog & Advice',icon:'nav-blogs'}]},{label:'COMMERCE',items:[{view:'orders' as View,name:'Orders & Fulfilment',icon:'nav-orders'},{view:'quotes' as View,name:'Quotations',icon:'nav-quotes'},{view:'promotions' as View,name:'Discounts & Coupons',icon:'nav-promotions'},{view:'reviews' as View,name:'Customer Reviews & Ratings',icon:'nav-reviews'},{view:'inquiries' as View,name:'Support & Technical Inquiries',icon:'nav-inquiries'},{view:'customers' as View,name:'Customers',icon:'nav-customers'}]},{label:'GOVERNANCE',items:[{view:'audit' as View,name:'Audit Log',icon:'nav-audit'}]}];
 initials=computed(()=>this.user()?.name.split(' ').map(x=>x[0]).join('').slice(0,2)||'A');firstName=computed(()=>this.user()?.name.split(' ')[0]||'there');roleLabel=computed(()=>this.pretty(this.user()?.role||''));productPages=computed(()=>this.pageNumbers(this.productPage(),this.productTotalPages()));productRangeStart=computed(()=>this.productTotalElements()?this.productPage()*this.productPageSize+1:0);productRangeEnd=computed(()=>Math.min((this.productPage()+1)*this.productPageSize,this.productTotalElements()));auditPages=computed(()=>this.pageNumbers(this.auditPage(),this.auditTotalPages()));auditRangeStart=computed(()=>this.auditTotalElements()?this.auditPage()*this.auditPageSize+1:0);auditRangeEnd=computed(()=>Math.min((this.auditPage()+1)*this.auditPageSize,this.auditTotalElements()));quoteValue=computed(()=>this.quotes().reduce((s,q)=>s+q.totalMinor,0));
  categoryMatches(itemCat: string, filterCat: string): boolean {
    if (!filterCat || !filterCat.trim()) return true;
    if (!itemCat || !itemCat.trim()) return false;
    const c1 = itemCat.toLowerCase().trim();
    const c2 = filterCat.toLowerCase().trim();
    if (c1 === c2) return true;
    if (c1.includes(c2) || c2.includes(c1)) return true;
    // Common Heating / Plumbing aliases & category keywords
    if ((c2.includes('bath') && (c1.includes('bath') || c1.includes('towel') || c1.includes('alex') || c1.includes('suite'))) ||
        (c2.includes('rad') && (c1.includes('rad') || c1.includes('convector') || c1.includes('column') || c1.includes('compact') || c1.includes('df'))) ||
        (c2.includes('towel') && (c1.includes('towel') || c1.includes('rail') || c1.includes('warmer') || c1.includes('bath'))) ||
        (c2.includes('electric') && (c1.includes('electric') || c1.includes('wifi') || c1.includes('element') || c1.includes('probe'))) ||
        (c2.includes('valve') && (c1.includes('valve') || c1.includes('trv') || c1.includes('pipe') || c1.includes('sleeve') || c1.includes('twin'))) ||
        (c2.includes('sale') && (c1.includes('sale') || c1.includes('clearance') || c1.includes('deal') || c1.includes('drop')))) {
      return true;
    }
    return false;
  }

  onImgError(event: Event, fallbackUrl = '/thp-logo.jpg') {
    const el = event.target as HTMLImageElement;
    if (el) {
      el.onerror = null;
      el.src = fallbackUrl;
    }
  }

  allMediaPickerImages = computed(() => {
    const q = (this.mediaPickerSearch || '').toLowerCase().trim();
    const filterCat = (this.mediaPickerCategory || '').trim();
    const filterMode = this.mediaPickerCategoryFilter();
    const list: Array<{ filename: string; url: string; category?: string; isNew?: boolean }> = [];
    const seen = new Set<string>();

    // Build URL-to-category dictionary from products & navigation
    const catMap = new Map<string, string>();
    for (const p of (this.allProductsList().length ? this.allProductsList() : this.products())) {
      if (p.imageUrl && p.category) catMap.set(p.imageUrl, p.category);
      for (const v of (p.variants || [])) {
        if (v.imageUrl && p.category) catMap.set(v.imageUrl, p.category);
      }
    }
    for (const m of this.navMenus()) {
      if (m.imageUrl && m.category) catMap.set(m.imageUrl, m.category);
      if (m.featuredPromo?.imageUrl && m.category) catMap.set(m.featuredPromo.imageUrl, m.category);
      for (const sub of (m.filterOptions?.subcategories || [])) {
        if (sub.imageUrl && m.category) catMap.set(sub.imageUrl, m.category);
      }
    }

    const add = (filename: string, url?: string, cat?: string, isNew?: boolean) => {
      if (!url || seen.has(url)) return;
      const resolvedCat = cat || catMap.get(url) || '';
      if (filterMode === 'CURRENT' && filterCat && !isNew) {
        const match = this.categoryMatches(resolvedCat, filterCat) ||
                      this.categoryMatches(filename, filterCat) ||
                      this.categoryMatches(url, filterCat);
        if (!match) return;
      }
      if (q) {
        const matchQ = filename.toLowerCase().includes(q) ||
                       url.toLowerCase().includes(q) ||
                       resolvedCat.toLowerCase().includes(q);
        if (!matchQ) return;
      }
      seen.add(url);
      list.push({ filename: filename || 'Image', url, category: resolvedCat, isNew });
    };

    // 0. FIRST AND FOREMOST: Recently uploaded images in this session
    for (const r of this.recentlyUploadedPickerImages()) {
      add(r.filename || 'Uploaded Image', r.url, r.category || filterCat, true);
    }

    // 1. Uploaded media library assets
    for (const m of this.uploadedMediaList()) {
      add(m.filename || m.assignedSku || 'Library Image', m.url, m.category);
    }
    // 2. Navigation & subcategories images
    for (const m of this.navMenus()) {
      if (m.imageUrl) add(`${m.title || m.category} Category Banner`, m.imageUrl, m.category);
      if (m.featuredPromo?.imageUrl) add(`${m.title || m.category} Promo Card`, m.featuredPromo.imageUrl, m.category);
      for (const sub of (m.filterOptions?.subcategories || [])) {
        if (sub.imageUrl) add(`${sub.label || 'Subcategory'} (${m.category})`, sub.imageUrl, m.category);
      }
    }
    // 3. Products & variants in catalogue
    for (const p of (this.allProductsList().length ? this.allProductsList() : this.products())) {
      if (p.imageUrl) add(`${p.sku} - ${p.name}`, p.imageUrl, p.category);
      for (const v of (p.variants || [])) {
        if (v.imageUrl) add(`${v.variantSku || p.sku} (${v.colour || 'variant'})`, v.imageUrl, p.category);
      }
    }
    // 4. Sample media images if in ALL mode or matches
    for (const s of this.sampleMediaImages) {
      add(s.filename, s.url);
    }

    return list;
  });
 constructor(){if(this.user())this.loadDashboard();window.addEventListener('admin-rate-limit',(e:any)=>{const secs=e.detail?.retryAfter||60;this.notify(`Rate limit reached (429). Please wait ${secs}s before retrying.`);});}
 addVariant(){this.productDraft.variants.push({ean:'',variantSku:this.productDraft.sku,configCode:'',colour:'',baseColour:'',colourCode:'',paintType:'',panel:'',priceMinor:Math.round(this.productPrice*100),costMinor:Math.round(this.productCost*100),discountPercent:this.productDraft.discountPercent||0,stock:0,availability:'LEAD TIME',productionTime:'',leadTime:''})}
 removeVariant(index:number){this.productDraft.variants.splice(index,1)}
 toMinor(value:number|string){const parsed=Number(value);return Number.isFinite(parsed)?Math.round(parsed*100):0}
 syncAllToStorefront(){this.syncingAll.set(true);this.http.post<any>('/api/products/sync-all',{}).pipe(finalize(()=>this.syncingAll.set(false)),catchError(e=>{this.notify(e.error?.message||'Sync failed. Ensure storefront is reachable.');return of(null)})).subscribe(r=>{if(r){this.notify(`Storefront sync complete: ${r.synced} products synced (${r.failed} failed)`);this.loadProducts()}})}
 syncSingleProduct(p:Product,event?:Event){if(event)event.stopPropagation();if(!p.id)return;this.syncingProductId.set(p.id);this.http.post<any>(`/api/products/${p.id}/sync`,{}).pipe(finalize(()=>this.syncingProductId.set(null)),catchError(e=>{this.notify(e.error?.message||'Sync failed for '+p.sku);return of(null)})).subscribe(r=>{if(r){p.syncStatus=r.syncStatus;if(p.status==='DRAFT'){this.notify(`⚡ Synced ${p.sku}! (Note: Status is DRAFT, so product remains hidden from Storefront until published)`)}else{this.notify(r.success?`⚡ Synced ${p.sku} to storefront`:`Sync failed: ${r.syncError||'Storefront error'}`)}this.loadProducts()}})}
 toggleProductStatus(p:Product,event?:Event){if(event)event.stopPropagation();if(!p.id)return;const next=p.status==='PUBLISHED'?'DRAFT':'PUBLISHED';const body={...p,status:next};this.http.put<any>(`/api/products/${p.id}`,body).pipe(catchError(e=>{this.notify(e.error?.message||'Could not change status');return of(null)})).subscribe(r=>{if(r){p.status=next;p.syncStatus=r.syncStatus;this.notify(next==='PUBLISHED'?`Published ${p.sku} and synced to storefront!`:`Set ${p.sku} to DRAFT (hidden from storefront)`);this.loadProducts()}})}
 deleteProduct(p:Product,event?:Event){if(event)event.stopPropagation();if(!p.id)return;if(!confirm(`Delete product "${p.name}" (${p.sku})? This will remove it from Admin and Storefront.`))return;this.http.delete<any>(`/api/products/${p.id}`).pipe(catchError(e=>{this.notify(e.error?.message||'Could not delete product');return of(null)})).subscribe(()=>{if(this.modal()?.type==='productDetails'&&this.productDraft?.id===p.id){this.closeModal()}this.notify(`Deleted product ${p.sku}`);this.loadProducts()})}
 openBulkProductsModal(){this.parsedCsvProducts.set([]);this.csvRawFilename.set('');this.bulkImportMode.set('csv');this.modal.set({type:'bulkProducts',kicker:'CATALOGUE IMPORT',title:'Bulk Product Import'})}
 onCsvFileSelected(event:Event){const input=event.target as HTMLInputElement;const file=input.files?.[0];if(!file)return;this.csvRawFilename.set(file.name);file.text().then(text=>{const rows=this.parseCsv(text);if(rows.length<2){this.notify('The CSV has no product rows');return}const headers=rows[0].map(x=>x.trim().toLowerCase());const value=(row:string[],key:string)=>row[headers.indexOf(key)]?.trim()||'';const number=(row:string[],key:string,fallback=0)=>{const raw=value(row,key);const parsed=raw===''?fallback:Number(raw);return Number.isFinite(parsed)&&parsed>=0?parsed:fallback};const products=rows.slice(1).filter(r=>r.some(c=>c.trim())).map((row,index)=>({sku:value(row,'sku')||`PROD-${index+1}`,name:value(row,'name')||'Unnamed Product',brand:value(row,'brand')||'Hearth',category:value(row,'category')||'Designer Radiators',description:value(row,'description')||'',priceMinor:Math.round(number(row,'price')*100),costMinor:Math.round(number(row,'cost')*100),stock:Math.round(number(row,'stock',10)),lowStockThreshold:Math.round(number(row,'lowstockthreshold',5)),status:(value(row,'status')||'PUBLISHED').toUpperCase(),taxClass:(value(row,'taxclass')||'STANDARD').toUpperCase(),shippingClass:(value(row,'shippingclass')||'STANDARD').toUpperCase(),imageUrl:value(row,'imageurl')||undefined,variants:[]}));this.parsedCsvProducts.set(products)}).catch(e=>this.notify('Failed to parse CSV: '+e.message))}
 confirmBulkCsvImport(){const prods=this.parsedCsvProducts();if(!prods.length){this.notify('Select a valid CSV first');return}this.importingProducts.set(true);const toSend=prods.map(p=>({...p,status:this.csvAutoPublish()?'PUBLISHED':p.status}));this.http.post<any>('/api/products/import',toSend).pipe(finalize(()=>this.importingProducts.set(false)),catchError(e=>{this.notify(e.error?.message||'Import failed');return of(null)})).subscribe(res=>{if(res){this.closeModal();this.productPage.set(0);this.notify(`Imported ${res.created} new and updated ${res.updated} products! Synced to storefront.`);this.loadProducts()}})}
 confirmBulkExcelImport(event:Event){const input=event.target as HTMLInputElement;const file=input.files?.[0];if(!file)return;this.importingProducts.set(true);const form=new FormData();form.append('file',file);this.http.post<any>('/api/products/import-workbook',form).pipe(finalize(()=>{this.importingProducts.set(false);input.value=''}),catchError(e=>{this.notify(e.error?.message||'Excel import failed');return of(null)})).subscribe(result=>{if(result){this.closeModal();this.productPage.set(0);const skipped=result.skipped?` · ${result.skipped} rows skipped`:'';this.notify(`Imported ${result.created} products, updated ${result.updated}, ${result.variants} variants${skipped} and synced to storefront`);this.loadProducts()}})}
 openMediaManager(){this.bulkImageResults.set([]);this.selectedMediaUrl.set('');this.mediaManagerTab.set('upload');this.modal.set({type:'mediaManager',kicker:'DIGITAL ASSETS',title:'Bulk Images & Media Manager'});this.loadMediaGallery();this.loadAllProductsForAssignment()}
  loadMediaGallery(){
    this.loadingMedia.set(true);
    this.http.get<any[]>('/api/products/images').pipe(
      finalize(()=>this.loadingMedia.set(false)),
      catchError(()=>of([]))
    ).subscribe(imgs=>{
      const recent = this.recentlyUploadedPickerImages();
      const serverImgs = (imgs || []).filter(img => !recent.some(r => r.url === img.url));
      const combined = [...recent, ...serverImgs];
      this.uploadedMediaList.set(combined);
      this.notify(`✓ Media library refreshed (${combined.length} assets available)`);
    });
  }
 loadAllProductsForAssignment(){this.http.get<any>('/api/products?size=100').pipe(catchError(()=>of({content:[],totalPages:1}))).subscribe(r=>{let list=r.content||[];this.allProductsList.set(list);if(r.totalPages&&r.totalPages>1){const reqs=[];for(let p=1;p<r.totalPages;p++){reqs.push(this.http.get<any>(`/api/products?page=${p}&size=100`).pipe(catchError(()=>of({content:[]}))));}forkJoin(reqs).subscribe(pages=>{for(const pg of pages){if(pg?.content?.length)list=list.concat(pg.content);}this.allProductsList.set(list);});}})}
 uploadBulkImages(event:Event){const input=event.target as HTMLInputElement;const files=input.files;if(!files||!files.length)return;this.uploadingBulkImages.set(true);const form=new FormData();for(let i=0;i<files.length;i++)form.append('files',files[i]);this.http.post<any[]>('/api/products/images/bulk?autoMatch=true',form).pipe(finalize(()=>{this.uploadingBulkImages.set(false);input.value=''}),catchError(e=>{this.notify(e.error?.message||'Bulk image upload failed');return of(null)})).subscribe(res=>{if(res){this.bulkImageResults.set(res);const matched=res.filter(r=>r.matchType!=='NONE').length;this.notify(`Uploaded ${res.length} images (${matched} auto-matched & synced to storefront)`);this.loadMediaGallery();this.loadProducts();this.loadImageCoverage()}})}
 assignSelectedImage(imageUrl:string,productId:number){if(!productId||!imageUrl)return;this.assigningImage.set(true);this.http.post<any>('/api/products/images/assign',{imageUrl,productId}).pipe(finalize(()=>this.assigningImage.set(false)),catchError(e=>{this.notify(e.error?.message||'Could not assign image');return of(null)})).subscribe(res=>{if(res){this.notify(`Assigned image to ${res.productSku} and synced to storefront`);this.selectedMediaUrl.set('');this.loadMediaGallery();this.loadProducts();this.loadImageCoverage()}})}
 unassignSelectedImage(imageUrl:string,event?:Event){if(event)event.stopPropagation();if(!imageUrl)return;if(!confirm('Are you sure you want to de-assign this image from the product/variant?'))return;this.http.post<any>('/api/products/images/unassign',{imageUrl}).pipe(catchError(e=>{this.notify(e.error?.message||'Could not unassign image');return of(null)})).subscribe(res=>{if(res){this.notify(`De-assigned image from ${res.unassignedCount||1} product(s)/variant(s)`);this.selectedMediaUrl.set('');this.loadMediaGallery();this.loadProducts();this.loadImageCoverage()}})}
 copyToClipboard(text:string){if(navigator.clipboard){navigator.clipboard.writeText(text).then(()=>this.notify('Copied URL: '+text)).catch(()=>this.notify(text))}else this.notify(text)}
 importProducts(event:Event){const input=event.target as HTMLInputElement;const file=input.files?.[0];if(!file)return;if(file.name.toLowerCase().endsWith('.csv')){this.importProductsCsv(event);return}this.importingProducts.set(true);const form=new FormData();form.append('file',file);this.http.post<any>('/api/products/import-workbook',form).pipe(finalize(()=>{this.importingProducts.set(false);input.value=''}),catchError(e=>{this.notify(e.error?.message||'Workbook import failed');return of(null)})).subscribe(result=>{if(result){this.productPage.set(0);const skipped=result.skipped?` · ${result.skipped} rows skipped`:'';this.notify(`Imported ${result.created} new products, updated ${result.updated}, ${result.variants} variants${skipped}`);this.loadProducts()}})}
 importImageLibrary(event:Event){const input=event.target as HTMLInputElement;const file=input.files?.[0];if(!file)return;this.importingImages.set(true);const form=new FormData();form.append('file',file);this.http.post<any>('/api/products/import-images',form).pipe(finalize(()=>{this.importingImages.set(false);input.value=''}),catchError(e=>{this.notify(e.error?.message||'Image matching failed');return of(null)})).subscribe(result=>{if(result){this.notify(`Matched ${result.matched} EAN images · ${result.unmatched} unmatched`);this.loadProducts();this.loadImageCoverage()}})}
 login(){this.loading.set(true);this.error.set('');this.http.post<any>('/api/auth/login',{email:this.email,password:this.password}).pipe(finalize(()=>this.loading.set(false)),catchError(e=>{this.error.set(e.error?.message||'Unable to sign in. Is the backend running?');return of(null)})).subscribe(r=>{if(!r)return;sessionStorage.setItem('hearth_admin_token',r.token);const u={name:r.name,email:r.email,role:r.role};sessionStorage.setItem('hearth_admin_user',JSON.stringify(u));this.user.set(u);this.loadDashboard()})}
 logout(){this.http.post('/api/auth/logout',{}).pipe(catchError(()=>of(null)),finalize(()=>this.clearAdminSession())).subscribe()}
 clearAdminSession(){sessionStorage.removeItem('hearth_admin_token');sessionStorage.removeItem('hearth_admin_user');this.closeHeaderMenus();this.user.set(null)}
  go(v:View){this.view.set(v);this.navOpen.set(false);this.closeHeaderMenus();this.query='';if(v==='dashboard')this.loadDashboard();if(v==='navigation')this.loadNavigationMenus();if(v==='companies'){this.loadCompanies();this.loadBrands();}if(v==='products'){this.loadCompanies();this.loadProducts();}if(v==='customers')this.loadCustomers();if(v==='quotes'){this.loadQuotes();this.loadAllProductsForAssignment();}if(v==='orders')this.loadOrders();if(v==='promotions')this.loadPromotions();if(v==='inventory'){this.loadProducts();this.loadInventory();this.loadAllProductsForAssignment();}if(v==='inquiries')this.loadInquiries();if(v==='reviews')this.loadAdminReviews();if(v==='content')this.loadContent();if(v==='banners')this.loadBanners();if(v==='blogs')this.loadBlogs();if(v==='audit')this.loadAudit()}
  loadAdminReviews(){this.fetch('/api/reviews?status='+encodeURIComponent(this.reviewFilter),(r:any)=>this.reviews.set(r||[]))}
  approveAdminReview(r:any){this.http.post<any>(`/api/reviews/${r.id}/approve`,{}).subscribe(()=>{this.notify('Approved review by '+r.author);this.loadAdminReviews()})}
  rejectAdminReview(r:any){this.http.post<any>(`/api/reviews/${r.id}/reject`,{}).subscribe(()=>{this.notify('Rejected review by '+r.author);this.loadAdminReviews()})}
  deleteAdminReview(r:any){if(confirm('Are you sure you want to delete this review by '+r.author+'?')){this.http.delete(`/api/reviews/${r.id}`).subscribe(()=>{this.notify('Deleted review by '+r.author);this.loadAdminReviews()})}}
 loadImageCoverage(){this.fetch('/api/products/image-coverage',this.imageCoverage)} loadDashboard(){this.fetch('/api/dashboard',this.dashboardData)} loadProducts(){const url=`/api/products?page=${this.productPage()}&size=${this.productPageSize}&q=${encodeURIComponent(this.query.trim())}&status=${encodeURIComponent(this.productStatus)}&brand=${encodeURIComponent(this.productBrand||'')}`;this.fetch(url,(r:any)=>{this.products.set(r.content||[]);this.productTotalPages.set(Math.max(1,r.totalPages||1));this.productTotalElements.set(r.totalElements||0)})} applyProductFilters(){this.productPage.set(0);this.loadProducts()} goToProductPage(page:number){if(page===this.productPage()||page<0||page>=this.productTotalPages())return;this.productPage.set(page);this.loadProducts()} previousProductPage(){this.goToProductPage(this.productPage()-1)} nextProductPage(){this.goToProductPage(this.productPage()+1)} loadCustomers(){this.fetch('/api/customers?q='+encodeURIComponent(this.query),(r:any)=>this.customers.set(r.content||[]))} loadQuotes(){this.fetch('/api/quotations',this.quotes)} loadOrders(){this.fetch('/api/orders',this.orders)} loadInventory(){this.fetch('/api/inventory',this.inventory)} loadContent(){this.fetch('/api/content',this.contents);this.loadSocialLinks()} socialLinks: any = { facebook: 'https://www.facebook.com/share/1CPi7d3YxZ/', instagram: 'https://www.instagram.com/theheatingandplumbing?srtk=eGt6ZGhmZGcwajU1', tiktok: 'https://www.tiktok.com/@theheatingandplumbing', x: 'https://x.com/theheatingandplumbing', pinterest: 'https://pinterest.com/theheatingandplumbing' }; savingSocial = signal<boolean>(false); loadSocialLinks(){this.http.get<any>('/api/settings/social').subscribe({next:(data)=>{if(data)this.socialLinks={...this.socialLinks,...data}},error:()=>{}})} saveSocialLinks(){this.savingSocial.set(true);this.http.put<any>('/api/settings/social',this.socialLinks).subscribe({next:(res)=>{this.savingSocial.set(false);this.notify('✓ Brand social links saved and synced to Storefront!');if(res)this.socialLinks={...this.socialLinks,...res}},error:(err)=>{this.savingSocial.set(false);this.notify(err.error?.message||'Failed to save social links')}})} loadAudit(){const url=`/api/audit?page=${this.auditPage()}&size=${this.auditPageSize}`;this.fetch(url,(r:any)=>{this.audits.set(r.content||[]);this.auditTotalPages.set(Math.max(1,r.totalPages||1));this.auditTotalElements.set(r.totalElements||0)})} refreshAudit(){this.auditPage.set(0);this.loadAudit()} goToAuditPage(page:number){if(page===this.auditPage()||page<0||page>=this.auditTotalPages())return;this.auditPage.set(page);this.loadAudit()} previousAuditPage(){this.goToAuditPage(this.auditPage()-1)} nextAuditPage(){this.goToAuditPage(this.auditPage()+1)}
 fetch(url:string,target:any){this.loading.set(true);this.http.get<any>(url).pipe(finalize(()=>this.loading.set(false)),catchError(e=>{this.notify(e.error?.message||'Could not load data');return of(null)})).subscribe(r=>{if(r===null)return;if(target&&typeof target.set==='function')target.set(r);else if(typeof target==='function')target(r)})}
 newProduct(){this.productDraft=this.emptyProduct();this.productDraft.discountPercent=0;this.productPrice=0;this.productCost=0;this.selectedImageName='';this.productDocuments=[];if(!this.contents().length)this.loadContent();this.modal.set({type:'product',kicker:'CATALOGUE',title:'Add a product'})} productHeightSummary(p:Product){const hs=Array.from(new Set((p.variants||[]).map(v=>v.heightMm).filter((v):v is number=>v!=null&&v>0))).sort((a,b)=>a-b);if(!hs.length){const m=(p.name||'').match(/(\d{3,4})\s*mm/i);return m?`${m[1]} mm`:'—'}return hs.length===1?`${hs[0]} mm`:`${hs[0]} – ${hs[hs.length-1]} mm (${hs.length} options)`} productWidthSummary(p:Product){const ws=Array.from(new Set((p.variants||[]).map(v=>v.widthMm).filter((v):v is number=>v!=null&&v>0))).sort((a,b)=>a-b);if(!ws.length)return'—';return ws.length===1?`${ws[0]} mm`:`${ws[0]} – ${ws[ws.length-1]} mm (${ws.length} options)`} viewProduct(p:Product){this.productDraft={...p,variants:(p.variants||[]).map(v=>({...v}))};this.modal.set({type:'productDetails',kicker:'PRODUCT DETAILS',title:p.name})} editProduct(p:Product){this.productDraft={...p,discountPercent:p.discountPercent!=null?p.discountPercent:20,variants:(p.variants||[]).map(v=>({...v}))};this.productPrice=p.priceMinor/100;this.productCost=(p.costMinor||0)/100;this.selectedImageName='';try{this.productDocuments=p.documentsJson?JSON.parse(p.documentsJson):[];if(!Array.isArray(this.productDocuments))this.productDocuments=[];}catch(e){this.productDocuments=[];}if(!this.contents().length)this.loadContent();if(p.staticContentSlug&&!this.productDraft.staticContentId){const match=this.contents().find(c=>c.slug===p.staticContentSlug);if(match)this.productDraft.staticContentId=match.id;}this.modal.set({type:'product',kicker:'CATALOGUE',title:'Edit product'})}
 uploadProductImage(event:Event){const input=event.target as HTMLInputElement;const file=input.files?.[0];if(!file)return;if(file.size>5*1024*1024){this.notify('Image must be 5 MB or smaller');input.value='';return}const form=new FormData();form.append('file',file);this.uploadingImage.set(true);this.http.post<{url:string}>('/api/products/images',form).pipe(finalize(()=>this.uploadingImage.set(false)),catchError(e=>{this.notify(e.error?.message||'Image upload failed');input.value='';return of(null)})).subscribe(r=>{if(r){this.productDraft.imageUrl=r.url;this.selectedImageName=file.name;this.notify('Image uploaded')}})}
  downloadProductImportSample(){const csv='sku,name,brand,category,description,price,cost,stock,lowStockThreshold,status,taxClass,shippingClass,imageUrl\nOXF-001,Oxford Cast Iron Designer Radiator,Hearth Luxury,Designer Radiators,Authentic Victorian aesthetic with high BTU heat output and bespoke finish options,795.00,380.00,15,3,PUBLISHED,STANDARD,STANDARD,https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=1200&q=80\nCAM-002,Cambridge Brass Towel Rail,Hearth Luxury,Heated Towel Rails,Solid unlacquered brushed brass finish with generous rung spacing,420.00,195.00,25,5,PUBLISHED,STANDARD,STANDARD,https://images.unsplash.com/photo-1584622781564-1d987f7333c1?auto=format&fit=crop&w=1200&q=80\nVER-003,Verona Vertical Column Radiator,Terma,Vertical Radiators,Contemporary vertical design crafted for compact luxury interiors,550.00,260.00,12,4,PUBLISHED,STANDARD,STANDARD,https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?auto=format&fit=crop&w=1200&q=80\nEL-004,Kyoto Smart Electric Radiator,Terma,Electric Radiators,Wi-Fi app enabled smart ceramic heating with daily schedule programming,680.00,310.00,18,4,PUBLISHED,STANDARD,STANDARD,https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=1200&q=80\n';const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));const link=document.createElement('a');link.href=url;link.download='hearth-product-import-sample.csv';link.click();URL.revokeObjectURL(url)}
  downloadExcelImportSample(){this.http.get('/api/products/import-workbook/sample',{responseType:'blob'}).subscribe({next:(blob)=>{const url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;link.download='hearth-product-import-sample.xlsx';link.click();URL.revokeObjectURL(url)},error:()=>this.notify('Could not download sample Excel workbook')})}
 importProductsCsv(event:Event){const input=event.target as HTMLInputElement;const file=input.files?.[0];if(!file)return;this.importingProducts.set(true);file.text().then(text=>{const rows=this.parseCsv(text);if(rows.length<2)throw new Error('The CSV does not contain any product rows');const headers=rows[0].map(x=>x.trim());const required=['sku','name','brand','category'];const missing=required.filter(x=>!headers.includes(x));if(missing.length)throw new Error('Missing required columns: '+missing.join(', '));const value=(row:string[],key:string)=>row[headers.indexOf(key)]?.trim()||'';const products=rows.slice(1).filter(row=>row.some(cell=>cell.trim())).map((row,index)=>{const number=(key:string,fallback=0)=>{const raw=value(row,key);const parsed=raw===''?fallback:Number(raw);if(!Number.isFinite(parsed)||parsed<0)throw new Error(`Invalid ${key} on row ${index+2}`);return parsed};return{sku:value(row,'sku'),name:value(row,'name'),brand:value(row,'brand'),category:value(row,'category'),description:value(row,'description'),priceMinor:Math.round(number('price')*100),costMinor:Math.round(number('cost')*100),stock:Math.round(number('stock')),lowStockThreshold:Math.round(number('lowStockThreshold',10)),status:(value(row,'status')||'PUBLISHED').toUpperCase(),taxClass:(value(row,'taxClass')||'STANDARD').toUpperCase(),shippingClass:(value(row,'shippingClass')||'STANDARD').toUpperCase(),imageUrl:value(row,'imageUrl')||undefined}});if(products.some(p=>!p.sku||!p.name||!p.brand||!p.category))throw new Error('SKU, name, brand and category are required on every row');this.http.post<any>('/api/products/import',products).pipe(finalize(()=>{this.importingProducts.set(false);input.value=''}),catchError(e=>{this.notify(e.error?.message||'Product import failed');return of(null)})).subscribe(result=>{if(result){this.productPage.set(0);this.notify(`Imported ${result.created} new and updated ${result.updated} products`);this.loadProducts()}})}).catch(e=>{this.importingProducts.set(false);input.value='';this.notify(e.message||'Could not read the CSV file')})}
 parseCsv(text:string){const rows:string[][]=[];let row:string[]=[],cell='',quoted=false;for(let i=0;i<text.length;i++){const char=text[i];if(char==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i++}else quoted=!quoted}else if(char===','&&!quoted){row.push(cell);cell=''}else if((char==='\n'||char==='\r')&&!quoted){if(char==='\r'&&text[i+1]==='\n')i++;row.push(cell);if(row.some(x=>x.length))rows.push(row);row=[];cell=''}else cell+=char}row.push(cell);if(row.some(x=>x.length))rows.push(row);return rows}
 saveProduct(){this.saving.set(true);this.productDraft.priceMinor=Math.round(this.productPrice*100);this.productDraft.discountPercent=Number(this.productDraft.discountPercent!=null?this.productDraft.discountPercent:0);this.productDraft.documentsJson=JSON.stringify((this.productDocuments||[]).filter(d=>(d.title&&d.title.trim())||(d.url&&d.url.trim())));if(this.productDraft.variants.length){if(!this.productDraft.unlimitedStock){this.productDraft.stock=this.productDraft.variants.reduce((sum,v)=>sum+(v.unlimitedStock?0:(Number(v.stock)||0)),0);}this.productDraft.variants.forEach(v=>{v.variantSku=v.variantSku.trim();v.ean=(v.ean||'').replace(/\D/g,'');v.priceMinor=Number(v.priceMinor)||this.productDraft.priceMinor;v.discountPercent=Number(v.discountPercent)||0;if(v.unlimitedStock)v.stock=9999;})}const id=this.productDraft.id;this.http.request(id?'PUT':'POST',id?`/api/products/${id}`:'/api/products',{body:this.productDraft}).pipe(finalize(()=>this.saving.set(false)),catchError(e=>{this.notify(e.error?.message||'Product could not be saved');return of(null)})).subscribe(r=>{if(r){this.closeModal();this.notify('Product saved and synced to storefront');this.loadProducts()}})}
 newCustomer(){this.customerDraft={name:'',email:'',phone:'',city:'',status:'ACTIVE',marketingConsent:false,adminNotes:''};this.modal.set({type:'customer',kicker:'CUSTOMERS',title:'Create customer'})} saveCustomer(){this.http.post('/api/customers',this.customerDraft).subscribe(()=>{this.closeModal();this.notify('Customer created');this.loadCustomers()})} toggleCustomerStatus(c:any){const nextAction=c.status==='ACTIVE'?'deactivate':'activate';if(!confirm(`Are you sure you want to ${nextAction} customer "${c.name}" (${c.email})?`))return;this.http.put<any>(`/api/customers/${c.id}/toggle-status`,{}).subscribe({next:(res)=>{this.notify(`Customer ${res.name} is now ${res.status} (synced to storefront)`);this.loadCustomers()},error:(e)=>this.notify(e.error?.message||'Failed to update customer status')})}
 newQuote(){
   this.quoteProductFilter.set('');
   this.quoteDraft = {
     customerName: '',
     customerEmail: '',
     customerAddress: '',
     companyEmail: 'sales@theheatingandplumbing.com',
     status: 'DRAFT',
     expiresOn: new Date(Date.now() + 30*24*3600*1000).toISOString().split('T')[0],
     notes: '',
     lineItems: [
       { selectedProductKey: null, productName: '', sku: '', quantity: 1, unitPrice: 0 }
     ]
   };
   this.loadAllProductsForAssignment();
   this.modal.set({ type: 'quote', kicker: 'SALES', title: 'New Quotation' });
 }

 editQuote(q: any){
   this.quoteProductFilter.set('');
   this.loadAllProductsForAssignment();
   let parsedLines: any[] = [];
   try {
     parsedLines = q.lineItemsJson ? JSON.parse(q.lineItemsJson) : [];
   } catch (e) {
     parsedLines = [];
   }
   if (!parsedLines.length) {
     parsedLines = [{ selectedProductKey: null, productName: '', sku: '', quantity: 1, unitPrice: 0 }];
   }
   const list = this.allProductsList().length ? this.allProductsList() : this.products();
   const mappedLines = parsedLines.map((item: any) => {
     let matchedKey = item.selectedProductKey || null;
     if (!matchedKey && item.sku) {
       const p = list.find(prod => prod.sku === item.sku);
       if (p) {
         matchedKey = 'p_' + p.id;
       } else {
         for (const prod of list) {
           const v = (prod.variants || []).find(varItem => varItem.variantSku === item.sku || varItem.ean === item.sku);
           if (v) {
             matchedKey = 'v_' + prod.id + '_' + (v.variantSku || v.ean);
             break;
           }
         }
       }
     }
     return {
       ...item,
       selectedProductKey: matchedKey
     };
   });

   this.quoteDraft = {
     id: q.id,
     quoteNumber: q.quoteNumber,
     customerName: q.customerName || '',
     customerEmail: q.customerEmail || '',
     customerAddress: q.customerAddress || '',
     companyEmail: q.companyEmail || 'sales@theheatingandplumbing.com',
     status: q.status || 'DRAFT',
     expiresOn: q.expiresOn ? String(q.expiresOn).split('T')[0] : new Date(Date.now() + 30*24*3600*1000).toISOString().split('T')[0],
     notes: q.notes || '',
     lineItems: mappedLines
   };
   this.modal.set({ type: 'quote', kicker: 'SALES', title: 'Edit Quotation #' + q.quoteNumber });
 }

 addQuoteLine(){
   if (!this.quoteDraft.lineItems) this.quoteDraft.lineItems = [];
   this.quoteDraft.lineItems.push({ selectedProductKey: null, productName: '', sku: '', quantity: 1, unitPrice: 0 });
 }

 onQuoteProductSelected(item: any){
   if (!item.selectedProductKey) return;
   const list = this.allProductsList().length ? this.allProductsList() : this.products();
   if (item.selectedProductKey.startsWith('v_')) {
     const afterV = item.selectedProductKey.substring(2);
     const firstUnderscore = afterV.indexOf('_');
     if (firstUnderscore !== -1) {
       const pId = Number(afterV.substring(0, firstUnderscore));
       const vSku = afterV.substring(firstUnderscore + 1);
       const prod = list.find(p => p.id === pId);
       if (prod) {
         const variant = (prod.variants || []).find(v => (v.variantSku || v.ean) === vSku);
         if (variant) {
           const spec = [variant.colour, (variant.heightMm && variant.widthMm) ? `${variant.heightMm}×${variant.widthMm}mm` : ''].filter(Boolean).join(', ');
           item.productName = `${prod.name}${spec ? ' (' + spec + ')' : ''}`;
           item.sku = variant.variantSku || prod.sku;
           item.unitPrice = (variant.priceMinor != null && variant.priceMinor > 0) ? (variant.priceMinor / 100) : ((prod.priceMinor || 0) / 100);
           return;
         }
       }
     }
   } else if (item.selectedProductKey.startsWith('p_')) {
     const pId = Number(item.selectedProductKey.replace('p_', ''));
     const prod = list.find(p => p.id === pId);
     if (prod) {
       item.productName = prod.name;
       item.sku = prod.sku;
       item.unitPrice = (prod.priceMinor || 0) / 100;
       return;
     }
   }
 }

 onQuoteProductDropdownChange(item: any){
   this.onQuoteProductSelected(item);
 }

 removeQuoteLine(idx: number){
   if (this.quoteDraft.lineItems && this.quoteDraft.lineItems.length > 1) {
     this.quoteDraft.lineItems.splice(idx, 1);
   }
 }

 onQuoteLineProductSelected(item: any){
   const found = this.products().find(p => p.name === item.productName || p.sku === item.productName);
   if (found) {
     item.productName = found.name;
     item.sku = found.sku;
     item.unitPrice = (found.priceMinor || 0) / 100;
   }
 }

 get quoteTotalCalculated(): number {
   if (!this.quoteDraft?.lineItems) return 0;
   const sub = this.quoteDraft.lineItems.reduce((acc: number, it: any) => acc + ((Number(it.quantity) || 0) * (Number(it.unitPrice) || 0)), 0);
   return sub * 1.20;
 }

 saveQuote(){
   if (!this.quoteDraft.customerName || !this.quoteDraft.customerEmail) {
     this.notify('Customer Name and Customer Email are required');
     return;
   }
   this.savingQuote.set(true);
   const subtotal = (this.quoteDraft.lineItems || []).reduce((acc: number, it: any) => acc + ((Number(it.quantity) || 0) * (Number(it.unitPrice) || 0)), 0);
   const tax = subtotal * 0.20;
   const total = subtotal + tax;

   const payload: any = {
     customerName: this.quoteDraft.customerName,
     customerEmail: this.quoteDraft.customerEmail,
     customerAddress: this.quoteDraft.customerAddress || '',
     companyEmail: this.quoteDraft.companyEmail || 'sales@theheatingandplumbing.com',
     status: this.quoteDraft.status || 'DRAFT',
     expiresOn: this.quoteDraft.expiresOn || null,
     notes: this.quoteDraft.notes || '',
     lineItemsJson: JSON.stringify(this.quoteDraft.lineItems || []),
     subtotalMinor: Math.round(subtotal * 100),
     taxMinor: Math.round(tax * 100),
     totalMinor: Math.round(total * 100)
   };

   const isEdit = !!this.quoteDraft.id;
   const request$ = isEdit
     ? this.http.put<any>('/api/quotations/' + this.quoteDraft.id, payload)
     : this.http.post<any>('/api/quotations', payload);

   request$.pipe(
     finalize(() => this.savingQuote.set(false))
   ).subscribe({
     next: (saved) => {
       this.closeModal();
       this.notify(isEdit ? ('Quotation ' + (saved.quoteNumber || '') + ' updated successfully') : ('Quotation ' + saved.quoteNumber + ' created successfully'));
       this.loadQuotes();
     },
     error: (e) => this.notify(e.error?.message || 'Error saving quotation')
   });
 }


viewQuoteDetails(q: any){
  this.selectedQuoteDetails = q;
  this.modal.set({ type: 'quoteDetails', kicker: 'FORMAL ESTIMATE', title: 'Quotation ' + q.quoteNumber });
}

downloadQuotePdf(q: any){
  this.selectedQuoteDetails = q;
  this.modal.set({ type: 'quoteDetails', kicker: 'FORMAL ESTIMATE', title: 'Quotation ' + q.quoteNumber });
  setTimeout(() => {
    window.print();
  }, 350);
}

sendQuoteEmail(q: any){
  if (!q || !q.id) return;
  const targetEmail = q.customerEmail || 'the customer';
  if (!confirm(`Send quotation ${q.quoteNumber || ('#' + q.id)} to ${targetEmail}?`)) return;
  this.sendingQuoteEmail.set(true);
  this.http.post<any>(`/api/quotations/${q.id}/send-email`, {}).subscribe({
    next: (res) => {
      this.sendingQuoteEmail.set(false);
      this.notify(res?.message || `Quotation successfully sent to ${targetEmail}`);
      this.loadQuotes();
      if (this.selectedQuoteDetails && this.selectedQuoteDetails.id === q.id) {
        this.selectedQuoteDetails.status = 'SENT';
      }
    },
    error: (err) => {
      this.sendingQuoteEmail.set(false);
      this.notify(err.error?.message || 'Failed to email quotation');
    }
  });
}


deleteQuote(q: any){
  if (confirm(`Delete quotation ${q.quoteNumber} for ${q.customerName}?`)) {
    this.http.delete(`/api/quotations/${q.id}`).subscribe({
      next: () => {
        this.notify('Quotation deleted');
        this.loadQuotes();
      },
      error: (e) => this.notify(e.error?.message || 'Failed to delete quote')
    });
  }
}

parseQuoteLines(json?: string): any[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
}

printDocument(){
  window.print();
}

loadBrands(){
  this.loadingBrands.set(true);
  this.http.get<any[]>('/api/products/brands').pipe(
    finalize(() => this.loadingBrands.set(false)),
    catchError(() => of([]))
  ).subscribe(list => {
    this.brands.set(list || []);
  });
}

toggleBrandProductsStatus(brand: string, active: boolean){
  this.http.post<any>(`/api/products/brands/${encodeURIComponent(brand)}/toggle-status?active=${active}`, {}).subscribe({
    next: (res) => {
      this.notify(`${active ? 'Activated' : 'Deactivated'} ${res.count} products for ${brand}`);
      this.loadBrands();
      this.loadProducts();
    },
    error: (e) => this.notify(e.error?.message || 'Failed to update brand products status')
  });
}

onVariantStockChange(){
  if (this.productDraft.variants?.length && !this.productDraft.unlimitedStock) {
    this.productDraft.stock = this.productDraft.variants.reduce((acc, v) => acc + (v.unlimitedStock ? 0 : (Number(v.stock) || 0)), 0);
  }
}

onStaticGuideSelected(){
  if (this.productDraft.staticContentId) {
    const found = this.contents().find(c => c.id === this.productDraft.staticContentId);
    if (found) {
      this.productDraft.staticContentSlug = found.slug;
    }
  } else {
    this.productDraft.staticContentSlug = '';
  }
}

openMediaPicker(targetType: string, variant?: any, category?: string){
  this.mediaPickerTarget = { type: targetType, variant: variant };
  this.mediaPickerCategory = category || (this.navMenuDraft?.category || '');
  this.mediaPickerCategoryFilter.set(this.mediaPickerCategory ? 'CURRENT' : 'ALL');
  this.mediaPickerSearch = '';
  this.loadMediaGallery();
  this.loadAllProductsForAssignment();
  this.mediaPickerActive.set(true);
}

closeMediaPicker(){
  this.mediaPickerActive.set(false);
  this.mediaPickerTarget = null;
  this.mediaPickerCategory = '';
}

applyMediaPicker(url: string){
  if (this.mediaPickerTarget?.type === 'product') {
    this.productDraft.imageUrl = url;
    this.notify('Product image selected');
  } else if (this.mediaPickerTarget?.type === 'variant' && this.mediaPickerTarget?.variant) {
    const v = this.mediaPickerTarget.variant;
    if (!v.imageUrl) {
      v.imageUrl = url;
    } else if (!v.imageUrlsJson) {
      v.imageUrlsJson = url;
    } else {
      v.imageUrlsJson = v.imageUrlsJson + ', ' + url;
    }
    this.notify('Variant image selected');
  } else if (this.mediaPickerTarget?.type === 'company') {
    this.companyDraft.logoUrl = url;
    this.notify('Company logo selected');
  } else if (this.mediaPickerTarget?.type === 'navCategory') {
    this.navMenuDraft.imageUrl = url;
    this.notify('Category featured image selected');
  } else if (this.mediaPickerTarget?.type === 'subcategory' && this.mediaPickerTarget?.variant) {
    this.mediaPickerTarget.variant.imageUrl = url;
    this.notify('Subcategory image selected');
  } else if (this.mediaPickerTarget?.type === 'navPromo') {
    if (!this.navMenuDraft.featuredPromo) this.navMenuDraft.featuredPromo = { tag: "", title: "", subtitle: "", cta: "", imageUrl: "" };
    this.navMenuDraft.featuredPromo.imageUrl = url;
    this.notify("Promo image selected");
  } else if (this.mediaPickerTarget?.type === 'banner') {
    this.bannerDraft.imageUrl = url;
    this.notify('Banner image selected');
  }
  this.closeMediaPicker();
}

uploadMediaPickerImage(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  if (file.size > 10 * 1024 * 1024) {
    this.notify('Image must be 10 MB or smaller');
    input.value = '';
    return;
  }
  const form = new FormData();
  form.append('file', file);
  this.uploadingPickerImage.set(true);
  this.http.post<{url: string; filename: string}>('/api/products/images', form).pipe(
    finalize(() => {
      this.uploadingPickerImage.set(false);
      input.value = '';
    }),
    catchError(e => {
      this.notify(e.error?.message || 'Image upload failed');
      return of(null);
    })
  ).subscribe(r => {
    if (r && r.url) {
      const cat = this.mediaPickerCategory || 'Bathrooms';
      const newEntry = {
        url: r.url,
        filename: file.name,
        assignedSku: file.name.replace(/\.[^/.]+$/, ''),
        category: cat,
        isNew: true
      };
      this.recentlyUploadedPickerImages.set([newEntry, ...this.recentlyUploadedPickerImages()]);
      this.uploadedMediaList.set([newEntry, ...this.uploadedMediaList()]);
      this.notify(`✓ Uploaded "${file.name}" to ${cat}! Showing first in list.`);
    }
  });
}

emptyCompany() {
  return {
    id: null,
    name: '',
    code: '',
    logoUrl: '',
    website: '',
    contactEmail: '',
    contactPhone: '',
    country: 'United Kingdom',
    description: '',
    status: 'ACTIVE',
    sortOrder: 1
  };
}

loadCompanies() {
  this.loadingCompanies.set(true);
  this.http.get<any[]>('/api/companies').pipe(
    finalize(() => this.loadingCompanies.set(false)),
    catchError(() => of([]))
  ).subscribe(list => {
    this.companyList.set(list || []);
  });
}

newCompany() {
  this.companyDraft = this.emptyCompany();
  this.modal.set({ type: 'company', kicker: 'MANUFACTURERS', title: 'Add Brand / Company' });
}

editCompany(c: any) {
  this.companyDraft = { ...c };
  this.modal.set({ type: 'company', kicker: 'MANUFACTURERS', title: 'Edit ' + c.name });
}

saveCompany() {
  if (!this.companyDraft.name || !this.companyDraft.code) {
    this.notify('Brand Name and Code are required');
    return;
  }
  this.savingCompany.set(true);
  const id = this.companyDraft.id;
  this.http.request(id ? 'PUT' : 'POST', id ? `/api/companies/${id}` : '/api/companies', { body: this.companyDraft }).pipe(
    finalize(() => this.savingCompany.set(false)),
    catchError(e => {
      this.notify(e.error?.message || 'Failed to save brand');
      return of(null);
    })
  ).subscribe(res => {
    if (res) {
      this.closeModal();
      this.notify(id ? 'Brand updated successfully' : 'Brand created successfully');
      this.loadCompanies();
      this.loadBrands();
    }
  });
}

deleteCompany(c: any) {
  if (confirm(`Delete brand / company "${c.name}"?`)) {
    this.http.delete(`/api/companies/${c.id}`).subscribe({
      next: () => {
        this.notify('Brand deleted');
        this.loadCompanies();
        this.loadBrands();
      },
      error: (e) => this.notify(e.error?.message || 'Failed to delete brand')
    });
  }
}

toggleCompanyStatus(c: any) {
  const nextStatus = c.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
  this.http.put<any>(`/api/companies/${c.id}`, { ...c, status: nextStatus }).subscribe({
    next: () => {
      c.status = nextStatus;
      this.notify(`Brand status changed to ${nextStatus}`);
      this.loadCompanies();
    },
    error: (e) => this.notify(e.error?.message || 'Failed to update brand status')
  });
}

emptyReview() {
  return {
    id: null,
    author: '',
    authorEmail: '',
    role: 'Verified Customer',
    location: 'United Kingdom',
    rating: 5,
    title: '',
    comment: '',
    category: 'Designer Radiators',
    productSku: '',
    verified: true,
    status: 'APPROVED'
  };
}

newReview() {
  this.reviewDraft = this.emptyReview();
  this.modal.set({ type: 'review', kicker: 'STOREFRONT SOCIAL PROOF', title: 'Add Customer Review' });
}

editReview(r: any) {
  this.reviewDraft = { ...r };
  this.modal.set({ type: 'review', kicker: 'STOREFRONT SOCIAL PROOF', title: 'Edit Customer Review' });
}

saveReview() {
  if (!this.reviewDraft.author || !this.reviewDraft.title || !this.reviewDraft.comment) {
    this.notify('Author, Headline, and Comment are required');
    return;
  }
  this.savingReview.set(true);
  const id = this.reviewDraft.id;
  this.http.request(id ? 'PUT' : 'POST', id ? `/api/reviews/${id}` : '/api/reviews', { body: this.reviewDraft }).pipe(
    finalize(() => this.savingReview.set(false)),
    catchError(e => {
      this.notify(e.error?.message || 'Failed to save review');
      return of(null);
    })
  ).subscribe(res => {
    if (res) {
      this.closeModal();
      this.notify(id ? 'Review updated successfully' : 'Review added successfully');
      this.loadAdminReviews();
    }
  });
}

addDocToProduct() {
  this.productDocuments.push({ title: '', url: '' });
}

removeDocFromProduct(idx: number) {
  this.productDocuments.splice(idx, 1);
}

uploadDocFile(event: any, doc: { title: string; url: string }) {
  const file = event.target?.files?.[0];
  if (!file) return;
  this.uploadingDoc.set(true);
  const fd = new FormData();
  fd.append('file', file);
  this.http.post<any>('/api/content/upload-pdf', fd).pipe(
    finalize(() => this.uploadingDoc.set(false)),
    catchError(e => {
      this.notify(e.error?.message || 'Failed to upload PDF');
      return of(null);
    })
  ).subscribe(res => {
    if (res && res.url) {
      doc.url = res.url;
      if (!doc.title) {
        doc.title = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
      }
      this.notify('✓ PDF uploaded: ' + file.name);
    }
  });
}

openSendOrderModal(o: any){
  this.selectedOrderForUpdate = o;
  this.orderCustomerNote = `Your order #${o.orderNumber} is confirmed and tracked under courier reference ${o.trackingNumber || 'DPD Express'}.`;
  this.modal.set({ type: 'sendCustomerOrder', kicker: 'COMMERCE DISPATCH', title: 'Send Fulfilment Update' });
}

confirmSendOrderUpdate(){
  if (!this.selectedOrderForUpdate) return;
  this.sendingCustomerNotification.set(true);
  this.http.post<any>(`/api/orders/${this.selectedOrderForUpdate.id}/send-customer-update`, {
    note: this.orderCustomerNote
  }).pipe(
    finalize(() => this.sendingCustomerNotification.set(false))
  ).subscribe({
    next: (r) => {
      this.closeModal();
      this.notify(r?.message || 'Fulfilment update email dispatched to customer');
    },
    error: (e) => this.notify(e.error?.message || 'Failed to send customer email')
  });
}

openSendInquiryModal(inq: any){
  this.selectedInquiryForUpdate = inq;
  this.inquiryCustomerMessage = inq.resolutionNotes || `Thank you for contacting THP Customer Support. Your inquiry ticket #${inq.ticketNumber || inq.id} has been reviewed by our technical team.`;
  this.modal.set({ type: 'sendCustomerInquiry', kicker: 'CUSTOMER SERVICE', title: 'Send Customer Response' });
}

confirmSendInquiryResponse(){
  if (!this.selectedInquiryForUpdate) return;
  this.sendingCustomerNotification.set(true);
  this.http.post<any>(`/api/inquiries/${this.selectedInquiryForUpdate.id}/send-customer-response`, {
    response: this.inquiryCustomerMessage
  }).pipe(
    finalize(() => this.sendingCustomerNotification.set(false))
  ).subscribe({
    next: (r) => {
      this.closeModal();
      this.notify(r?.message || 'Resolution email dispatched to customer');
      this.loadInquiries();
    },
    error: (e) => this.notify(e.error?.message || 'Failed to send customer email')
  });
}

downloadReportCsv(){
  const rows = [
    ['Metric', 'Value', 'Notes'],
    ['Gross Revenue', `£${((this.dashboardData()?.revenueMinor||0)/100).toFixed(2)}`, 'All channels combined'],
    ['Online Orders Placed', String(this.dashboardData()?.orders || this.orders().length), 'Storefront checkouts'],
    ['Active Formal Estimates', String(this.quotes().length), 'Trade & B2B quotations'],
    ['Total Registered Customers', String(this.dashboardData()?.customers || 0), 'Active user accounts'],
    ['Low Stock Items', String(this.dashboardData()?.lowStock || 0), 'Below warehouse threshold'],
    ['Payment / Processing Exceptions', String(this.dashboardData()?.paymentExceptions || 0), 'Needs attention'],
    ['Fixed VAT Rate', '20.0%', 'UK Standard VAT applicable on all product lines']
  ];
  const csvContent = 'data:text/csv;charset=utf-8,' + rows.map(e => e.map(x => `"${x.replace(/"/g, '""')}"`).join(',')).join('\n');
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement('a');
  link.setAttribute('href', encodedUri);
  link.setAttribute('download', `THP-Operational-Report-${new Date().toISOString().split('T')[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  this.notify('Operational report CSV downloaded');
}

exportMediaManifestCsv(){
  const media = this.bulkImageResults().length ? this.bulkImageResults() : this.sampleMediaImages;
  const rows = [
    ['Filename', 'Image URL', 'Assigned Product ID', 'Status'],
    ...media.map((m: any) => [
      m.filename || 'Product Asset',
      m.url || m,
      m.assignedProductId ? String(m.assignedProductId) : 'Unassigned',
      m.assignedProductId ? 'ASSIGNED' : 'UNASSIGNED'
    ])
  ];
  const csvContent = 'data:text/csv;charset=utf-8,' + rows.map(e => e.map(x => `"${String(x).replace(/"/g, '""')}"`).join(',')).join('\n');
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement('a');
  link.setAttribute('href', encodedUri);
  link.setAttribute('download', `THP-Media-Manifest-${new Date().toISOString().split('T')[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  this.notify('Media manifest CSV downloaded');
}
 newOrder(){this.notify('Manual order workflow is ready for line-item integration')}
 openStock(productId?:number){this.loadAllProductsForAssignment();if(!this.products().length)this.loadProducts();const list=this.allProductsList().length?this.allProductsList():this.products();const targetId=productId||list[0]?.id;this.stockDraft={productId:targetId,type:'ADD',quantity:1,warehouse:'Main Warehouse',reason:'Stock receipt',reference:''};this.modal.set({type:'stock',kicker:'INVENTORY',title:'Record stock movement'})} saveStock(){if(!this.stockDraft.productId){this.notify('Please select a product');return}if(!this.stockDraft.quantity||this.stockDraft.quantity<=0){this.notify('Quantity must be greater than 0');return}if(!this.stockDraft.reason||!this.stockDraft.reason.trim()){this.notify('Reason / note is required');return}this.saving.set(true);this.http.post<any>(`/api/inventory/${this.stockDraft.productId}/adjust`,this.stockDraft).pipe(finalize(()=>this.saving.set(false)),catchError(e=>{this.notify(e.error?.message||'Stock adjustment failed');return of(null)})).subscribe(r=>{if(r){this.closeModal();this.notify(`✓ Stock updated: now ${r.afterQuantity} units (synced to storefront)`);this.loadProducts();this.loadAllProductsForAssignment();this.loadInventory()}})} filteredInventoryProducts(){const list=this.allProductsList().length?this.allProductsList():this.products();const q=this.inventorySearch.toLowerCase().trim();return list.filter(p=>{if(this.onlyLowStock&&p.stock>(p.lowStockThreshold||5))return false;if(!q)return true;return(p.name&&p.name.toLowerCase().includes(q))||(p.sku&&p.sku.toLowerCase().includes(q))})}
 newContent(){this.contentEditorTab='editor';this.contentDraft={id:null,title:'',slug:'',type:'PAGE',status:'PUBLISHED',seoTitle:'',body:'',pdfUrl:'',pdfFilename:''};this.modal.set({type:'content',kicker:'STOREFRONT CRM',title:'Create New Page'})}
 editContent(c:any){this.contentEditorTab='editor';this.contentDraft={...c};this.modal.set({type:'content',kicker:'STOREFRONT CRM',title:'Edit '+c.title})}
 previewCmsHtml(c:any){this.modal.set({type:'htmlViewer',kicker:'CRM HTML VIEWER',title:c.title,data:c})}
 insertTag(tag:string){let s='';switch(tag){case 'b':s='<b>Bold text</b>';break;case 'i':s='<i>Italic text</i>';break;case 'h3':s='<h3>Section Heading</h3>';break;case 'p':s='<p>New paragraph text...</p>';break;case 'ul':s='<ul>\n  <li>Bullet point 1</li>\n  <li>Bullet point 2</li>\n</ul>';break;case 'quote':s='<blockquote>Important policy notice...</blockquote>';break;case 'table':s='<table border="1">\n  <tr><th>Specification</th><th>Detail</th></tr>\n  <tr><td>Company</td><td>DIGNITREE LTD</td></tr>\n</table>';break;case 'link':s='<a href="mailto:sales@theheatingandplumbing.com">sales@theheatingandplumbing.com</a>';break;}this.contentDraft.body=(this.contentDraft.body||'')+(this.contentDraft.body?'\n\n':'')+s}
 uploadCmsPdf(event:any){const file=event.target?.files?.[0];if(!file)return;if(!file.name.toLowerCase().endsWith('.pdf')&&file.type!=='application/pdf'){this.notify('Please upload a valid PDF document (.pdf)');return}this.uploadingPdf.set(true);const fd=new FormData();fd.append('file',file);this.http.post<any>('/api/content/upload-pdf',fd).pipe(finalize(()=>this.uploadingPdf.set(false)),catchError(e=>{this.notify(e.error?.message||'Failed to upload PDF');return of(null)})).subscribe(res=>{if(res&&res.url){this.contentDraft.pdfUrl=res.url;this.contentDraft.pdfFilename=res.filename||res.originalFilename||file.name;this.notify('✓ PDF uploaded & synced to Storefront successfully!')}})}
 removeCmsPdf(){this.contentDraft.pdfUrl='';this.contentDraft.pdfFilename='';this.notify('PDF attachment removed (save to apply changes)')}
 renderCmsHtml(body?:string):SafeHtml{if(!body)return this.sanitizer.bypassSecurityTrustHtml('<p class="muted">No content provided yet.</p>');let html=body.trim();if(!html.includes('<p>')&&!html.includes('<div>')&&!html.includes('<h3>')&&!html.includes('<table>')&&!html.includes('<br')){html=html.split('\n\n').map(p=>{if(p.startsWith('# '))return `<h1>${p.substring(2)}</h1>`;if(p.startsWith('## '))return `<h2>${p.substring(3)}</h2>`;if(p.startsWith('### '))return `<h3>${p.substring(4)}</h3>`;if(p.startsWith('- ')||p.startsWith('* ')){const items=p.split('\n').map(li=>`<li>${li.replace(/^[-*]\s*/,'')}</li>`).join('');return `<ul>${items}</ul>`}return `<p>${p.replace(/\n/g,'<br>')}</p>`}).join('')}return this.sanitizer.bypassSecurityTrustHtml(html)}
 saveContent(){if(!this.contentDraft.title||!this.contentDraft.slug){this.notify('Title and Slug are required');return}this.saving.set(true);const id=this.contentDraft.id;this.http.request(id?'PUT':'POST',id?`/api/content/${id}`:'/api/content',{body:this.contentDraft}).pipe(finalize(()=>this.saving.set(false)),catchError(e=>{this.notify(e.error?.message||'Failed to save page');return of(null)})).subscribe(r=>{if(r){this.closeModal();this.notify(id?'Page updated & synced to storefront':'Page created & synced to storefront');this.loadContent()}})}
 deleteContent(c:any){if(confirm(`Are you sure you want to delete "${c.title}"?`)){this.http.delete(`/api/content/${c.id}`).subscribe({next:()=>{this.notify('Page deleted');this.loadContent()},error:()=>this.notify('Failed to delete page')})}}
 toggleContentStatus(c:any){const nextStatus=c.status==='PUBLISHED'?'DRAFT':'PUBLISHED';this.http.put(`/api/content/${c.id}`,{...c,status:nextStatus}).subscribe({next:()=>{this.notify(`Status changed to ${nextStatus}`);this.loadContent()},error:()=>this.notify('Failed to update status')})}
 loadPromotions(){this.fetch('/api/promotions',this.promotions)}
 newPromotion(){this.promoDraft={code:'',label:'',discountType:'PERCENT',discountValue:10,minBasketMinor:0,active:true};this.promoMinBasket=0;this.modal.set({type:'promotion',kicker:'MARKETING',title:'Add Promotion Coupon'})}
 editPromotion(p:any){this.promoDraft={...p};this.promoMinBasket=p.minBasketMinor?p.minBasketMinor/100:0;this.modal.set({type:'promotion',kicker:'MARKETING',title:'Edit Promotion Coupon'})}
 savePromotion(){this.promoDraft.minBasketMinor=Math.round(this.promoMinBasket*100);this.saving.set(true);const id=this.promoDraft.id;this.http.request(id?'PUT':'POST',id?`/api/promotions/${id}`:'/api/promotions',{body:this.promoDraft}).pipe(finalize(()=>this.saving.set(false)),catchError(e=>{this.notify(e.error?.message||'Could not save promotion');return of(null)})).subscribe(r=>{if(r){this.closeModal();this.notify('Promotion saved & synced to storefront');this.loadPromotions()}})}
 togglePromotionActive(p:any){p.active=!p.active;this.http.put(`/api/promotions/${p.id}`,p).subscribe(()=>{this.notify(p.active?'Promotion activated':'Promotion paused');this.loadPromotions()})}
 syncAllPromotions(){this.promotions().forEach(p=>this.http.put(`/api/promotions/${p.id}`,p).subscribe());this.notify('All promotions synced to storefront')}
 loadInquiries(){const url=(this.inquiryFilter&&this.inquiryFilter!=='UNVERIFIED')?`/api/inquiries?status=${encodeURIComponent(this.inquiryFilter)}`:'/api/inquiries';this.fetch(url,this.inquiries)}
 filteredInquiries(){let list=this.inquiries();if(this.inquiryFilter==='UNVERIFIED'){list=list.filter(i=>i.hasOrderNumber&&!i.orderVerified);}const q=this.inquirySearch.toLowerCase().trim();if(!q)return list;return list.filter(i=>{const matchText=[i.ticketNumber,i.id,i.name,i.customerName,i.email,i.customerEmail,i.orderNumber,i.productName,i.message,i.resolutionNotes,i.category].filter(Boolean).join(' ').toLowerCase();return matchText.includes(q);})}
 openInquiryModal(inq:any){this.selectedInquiry.set(inq);this.inquiryResolutionNote=inq.resolutionNotes||'';this.inquiryDetailStatus=inq.status||'CONTACTED';this.modal.set({type:'inquiryDetails',kicker:'CUSTOMER CARE TICKET',title:inq.ticketNumber?`Ticket #${inq.ticketNumber}`:`Inquiry #${inq.id}`})}
 saveInquiryResolution(){const inq=this.selectedInquiry();if(!inq)return;this.saving.set(true);this.http.put(`/api/inquiries/${inq.id}/status`,{status:this.inquiryDetailStatus,resolutionNotes:this.inquiryResolutionNote,notes:this.inquiryResolutionNote}).pipe(finalize(()=>this.saving.set(false)),catchError(e=>{this.notify(e.error?.message||'Failed to update ticket');return of(null)})).subscribe(res=>{if(res){inq.status=this.inquiryDetailStatus;inq.resolutionNotes=this.inquiryResolutionNote;this.closeModal();this.notify('Ticket updated & resolution notes synced to customer');this.loadInquiries()}})}
 quickRejectInquiry(inq:any){const defaultReason=inq.hasOrderNumber&&!inq.orderVerified?`Rejected: Order #${inq.orderNumber} not found in store database. Valid order confirmation required.`:'Inquiry rejected - unverified customer purchase or invalid inquiry.';const reason=prompt(`Reason for rejecting ticket #${inq.ticketNumber||inq.id}:`,defaultReason);if(reason===null)return;this.http.put(`/api/inquiries/${inq.id}/status`,{status:'REJECTED',notes:reason,resolutionNotes:reason}).subscribe({next:()=>{inq.status='REJECTED';inq.resolutionNotes=reason;this.notify('✕ Ticket rejected and customer notified');this.loadInquiries()},error:()=>this.notify('Could not reject ticket')})}
 rejectInquiryAsUnverified(){const inq=this.selectedInquiry();if(!inq)return;this.inquiryDetailStatus='REJECTED';this.inquiryResolutionNote=`Rejected: Order reference #${inq.orderNumber||''} not found in store database. Valid order confirmation required for technical claims.`;this.saveInquiryResolution()}
 onThumbError(event:any){event.target.src='data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="44" height="44" viewBox="0 0 24 24" fill="%23f1f5f9" stroke="%2394a3b8" stroke-width="1.5"><rect width="18" height="18" x="3" y="3" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>';}
 isImage(url?:string):boolean{if(!url)return false;return/\.(jpeg|jpg|png|webp|gif)$/i.test(url)||url.startsWith('data:image/')}
 updateInquiryStatus(inq:any,status:string){this.http.put(`/api/inquiries/${inq.id}/status`,{status}).subscribe(()=>{inq.status=status;this.notify(`Inquiry updated to ${status}`)})}
 openDispatchModal(o:any){this.orderDraft={...o,carrier:o.carrier||'DPD Express Tracked 24',warehouse:o.warehouse||'Main Warehouse Leeds'};this.modal.set({type:'dispatchOrder',kicker:'FULFILMENT',title:'Dispatch Consignment'})}
 saveDispatch(){this.saving.set(true);this.http.put(`/api/orders/${this.orderDraft.id}`,this.orderDraft).pipe(finalize(()=>this.saving.set(false)),catchError(e=>{this.notify(e.error?.message||'Could not update order');return of(null)})).subscribe(saved=>{if(saved){this.closeModal();this.notify('Order updated & pushed to storefront tracking');this.loadOrders()}})}
 closeModal(){this.modal.set(null)} notify(msg:string){this.toast.set(msg);setTimeout(()=>this.toast.set(''),3000)}
 @HostListener('document:keydown',['$event']) onKeyboardShortcut(event:KeyboardEvent){if((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==='k'){event.preventDefault();this.focusGlobalSearch()}if(event.key==='Escape')this.closeHeaderMenus()}
 focusGlobalSearch(){this.notificationsOpen.set(false);this.profileOpen.set(false);this.searchOpen.set(true);setTimeout(()=>this.globalSearchInput?.nativeElement.focus())}
 queueGlobalSearch(){this.searchOpen.set(true);if(this.searchTimer)clearTimeout(this.searchTimer);if(!this.globalSearch.trim()){this.searchResults.set([]);return}this.searchTimer=setTimeout(()=>this.runGlobalSearch(),250)}
 runGlobalSearch(){const term=this.globalSearch.trim();if(!term){this.searchResults.set([]);return}this.searching.set(true);const safe=encodeURIComponent(term);forkJoin({products:this.http.get<any>(`/api/products?q=${safe}&size=6`).pipe(catchError(()=>of({content:[]}))),customers:this.http.get<any>(`/api/customers?q=${safe}`).pipe(catchError(()=>of({content:[]}))),orders:this.http.get<any[]>('/api/orders').pipe(catchError(()=>of([]))),quotes:this.http.get<any[]>('/api/quotations').pipe(catchError(()=>of([])))}).pipe(finalize(()=>this.searching.set(false))).subscribe(data=>{const needle=term.toLowerCase();const results:any[]=[];(data.products.content||[]).slice(0,4).forEach((p:any)=>results.push({type:'Product',icon:'▧',title:p.name,subtitle:`${p.sku} · ${p.category||'Uncategorised'}`,view:'products'}));(data.customers.content||[]).slice(0,4).forEach((c:any)=>results.push({type:'Customer',icon:'♙',title:c.name,subtitle:c.email,view:'customers'}));data.orders.filter((o:any)=>`${o.orderNumber} ${o.customerName} ${o.customerEmail}`.toLowerCase().includes(needle)).slice(0,3).forEach((o:any)=>results.push({type:'Order',icon:'▣',title:o.orderNumber,subtitle:`${o.customerName} · ${this.pretty(o.orderStatus)}`,view:'orders'}));data.quotes.filter((q:any)=>`${q.quoteNumber} ${q.customerName} ${q.customerEmail}`.toLowerCase().includes(needle)).slice(0,3).forEach((q:any)=>results.push({type:'Quote',icon:'▤',title:q.quoteNumber,subtitle:`${q.customerName} · ${this.pretty(q.status)}`,view:'quotes'}));this.searchResults.set(results.slice(0,8))})}
 searchAll(){if(!this.globalSearch.trim())return;if(this.searchResults().length)this.openSearchResult(this.searchResults()[0]);else this.runGlobalSearch()}
 openSearchResult(result:any){const term=this.globalSearch;this.go(result.view as View);if(result.view==='products'){this.query=term;this.loadProducts()}if(result.view==='customers'){this.query=term;this.loadCustomers()}this.searchOpen.set(false)}
 clearGlobalSearch(){this.globalSearch='';this.searchResults.set([]);this.searchOpen.set(false);this.globalSearchInput?.nativeElement.focus()}
 toggleNotifications(){this.profileOpen.set(false);this.searchOpen.set(false);this.notificationsOpen.update(v=>!v)} toggleProfile(){this.notificationsOpen.set(false);this.searchOpen.set(false);this.profileOpen.update(v=>!v)} markNotificationsRead(){this.unreadNotifications.set(false)} openNotification(view:View){this.unreadNotifications.set(false);this.notificationsOpen.set(false);this.go(view)} goFromProfile(view:View){this.profileOpen.set(false);this.go(view)} closeHeaderMenus(){this.searchOpen.set(false);this.notificationsOpen.set(false);this.profileOpen.set(false)}
 pretty(v:string){return (v||'').replaceAll('_',' ').toLowerCase().replace(/\b\w/g,c=>c.toUpperCase())} auditEntityName(a:any){return a.entityType==='ADMIN_USER'?(a.actor||a.entityId||'—'):(a.entityId||'—')} pageNumbers(current:number,total:number){const start=Math.max(0,Math.min(current-2,total-5));return Array.from({length:Math.min(5,total)},(_,i)=>start+i)} customerInitials(n:string){return n.split(' ').map(x=>x[0]).join('').slice(0,2)} stockPercent(v:number){return Math.min(100,Math.max(8,v*2))}
 

  navMenus = signal<any[]>([]);
  loadingNavMenus = signal<boolean>(false);
  savingNavMenu = signal<boolean>(false);
  navMenuDraftTab: 'general' | 'filters' | 'columns' | 'promo' = 'general';
  navMenuDraft: any = this.emptyNavMenu();

  emptyNavMenu() {
    return {
      id: null,
      menuId: "",
      title: "",
      category: "",
      icon: "🛁",
      badge: "",
      imageUrl: "",
      description: "",
      sortOrder: 1,
      status: "PUBLISHED",
      filterOptions: {
        showPriceFilter: true,
        showAvailabilityFilter: true,
        showBrandFilter: true,
        showColourFilter: true,
        showBtuFilter: false,
        showPanelTypeFilter: false,
        showHeightFilter: false,
        showFuelTypeFilter: false,
        subcategories: [],
        customFilters: []
      },
      columns: [
        {
          title: "Featured Collection",
          items: [{ label: "", query: "", category: "", badge: "" }]
        }
      ],
      featuredPromo: {
        tag: "EXCLUSIVE RANGE",
        title: "",
        subtitle: "",
        cta: "Explore Collection →",
        category: "",
        query: "",
        imageUrl: ""
      }
    };
  }

  countMenuLinks(m: any): number {
    if (!m.columns || !Array.isArray(m.columns)) return 0;
    return m.columns.reduce((acc: number, col: any) => acc + (col.items ? col.items.length : 0), 0);
  }

  loadNavigationMenus() {
    this.loadingNavMenus.set(true);
    this.http.get<any[]>("/api/navigation").pipe(
      finalize(() => this.loadingNavMenus.set(false)),
      catchError(err => {
        this.notify("Failed to load navigation menus");
        return of([]);
      })
    ).subscribe(list => {
      const parsed = (list || []).map(m => {
        let filterOptions = {
          showPriceFilter: true,
          showAvailabilityFilter: true,
          showBrandFilter: true,
          showColourFilter: true,
          showBtuFilter: false,
          showPanelTypeFilter: false,
          showHeightFilter: false,
          showFuelTypeFilter: false,
          subcategoryHeading: "Categories & Types",
          subcategories: [],
          customFilters: []
        };
        let columns: any[] = [];
        let featuredPromo: any = { tag: "", title: "", subtitle: "", cta: "", imageUrl: "" };
        try {
          if (m.filterOptionsJson) filterOptions = { ...filterOptions, ...JSON.parse(m.filterOptionsJson) };
        } catch(e) {}
        try {
          if (m.columnsJson) columns = JSON.parse(m.columnsJson);
        } catch(e) {}
        try {
          if (m.featuredPromoJson) featuredPromo = { ...featuredPromo, ...JSON.parse(m.featuredPromoJson) };
        } catch(e) {}
        return {
          ...m,
          filterOptions,
          columns: Array.isArray(columns) ? columns : [],
          featuredPromo: featuredPromo || {}
        };
      });
      this.navMenus.set(parsed);
    });
  }

  newNavMenu() {
    this.navMenuDraft = this.emptyNavMenu();
    this.navMenuDraft.sortOrder = this.navMenus().length + 1;
    this.navMenuDraftTab = "general";
    this.modal.set({
      title: "Add New Storefront Navigation Menu",
      kicker: "HEADER & MEGA-MENU CONFIGURATION",
      type: "navMenu"
    });
  }

  editNavMenu(m: any) {
    this.navMenuDraft = JSON.parse(JSON.stringify(m));
    if (!this.navMenuDraft.filterOptions) {
      this.navMenuDraft.filterOptions = {
        showPriceFilter: true,
        showAvailabilityFilter: true,
        showBrandFilter: true,
        showColourFilter: true,
        showBtuFilter: false,
        showPanelTypeFilter: false,
        showHeightFilter: false,
        showFuelTypeFilter: false,
        subcategories: [],
        customFilters: []
      };
    }
    if (!this.navMenuDraft.filterOptions.subcategories) {
      this.navMenuDraft.filterOptions.subcategories = [];
    }
    if (!this.navMenuDraft.filterOptions.customFilters) {
      this.navMenuDraft.filterOptions.customFilters = [];
    }
    if (!Array.isArray(this.navMenuDraft.columns)) {
      this.navMenuDraft.columns = [];
    }
    if (!this.navMenuDraft.featuredPromo) {
      this.navMenuDraft.featuredPromo = { tag: "", title: "", subtitle: "", cta: "", imageUrl: "" };
    }
    this.navMenuDraftTab = "general";
    this.modal.set({
      title: `Edit Menu: ${m.title}`,
      kicker: "HEADER & MEGA-MENU CONFIGURATION",
      type: "navMenu"
    });
  }

  toggleNavMenuStatus(m: any) {
    const updatedStatus = m.status === "PUBLISHED" ? "DRAFT" : "PUBLISHED";
    const payload = { ...m, status: updatedStatus };
    this.http.put<any>(`/api/navigation/${m.id}`, payload).subscribe({
      next: () => {
        m.status = updatedStatus;
        this.notify(`Menu ${m.title} switched to ${updatedStatus}`);
      },
      error: () => this.notify("Failed to update status")
    });
  }

  saveNavMenu() {
    if (!this.navMenuDraft.title || !this.navMenuDraft.title.trim()) {
      this.notify("Please provide a menu title");
      return;
    }
    if (!this.navMenuDraft.category || !this.navMenuDraft.category.trim()) {
      this.navMenuDraft.category = this.navMenuDraft.title.trim();
    }
    if (!this.navMenuDraft.menuId || !this.navMenuDraft.menuId.trim()) {
      this.navMenuDraft.menuId = this.navMenuDraft.title.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    }

    if (this.navMenuDraft.filterOptions?.customFilters) {
      this.navMenuDraft.filterOptions.customFilters = this.navMenuDraft.filterOptions.customFilters
        .filter((cfg: any) => cfg.name && cfg.name.trim())
        .map((cfg: any) => ({
          name: cfg.name.trim(),
          optionsStr: cfg.optionsStr || '',
          options: (cfg.optionsStr || '').split(',').map((s: string) => s.trim()).filter(Boolean)
        }));
    }

    this.savingNavMenu.set(true);
    const payload = {
      id: this.navMenuDraft.id,
      menuId: this.navMenuDraft.menuId,
      title: this.navMenuDraft.title,
      category: this.navMenuDraft.category,
      imageUrl: this.navMenuDraft.imageUrl || "",
      icon: this.navMenuDraft.icon,
      badge: this.navMenuDraft.badge,
      description: this.navMenuDraft.description,
      sortOrder: this.navMenuDraft.sortOrder || 1,
      status: this.navMenuDraft.status || "PUBLISHED",
      filterOptionsJson: JSON.stringify(this.navMenuDraft.filterOptions),
      columnsJson: JSON.stringify(this.navMenuDraft.columns),
      featuredPromoJson: JSON.stringify(this.navMenuDraft.featuredPromo)
    };

    const req$ = this.navMenuDraft.id
      ? this.http.put<any>(`/api/navigation/${this.navMenuDraft.id}`, payload)
      : this.http.post<any>("/api/navigation", payload);

    req$.pipe(finalize(() => this.savingNavMenu.set(false))).subscribe({
      next: () => {
        this.notify("✓ Navigation menu & dynamic filters saved and synced!");
        this.closeModal();
        this.loadNavigationMenus();
      },
      error: err => {
        this.notify(err.error?.message || "Failed to save navigation menu");
      }
    });
  }

  deleteNavMenu(m: any) {
    if (confirm(`Are you sure you want to delete menu "${m.title}"?`)) {
      this.http.delete(`/api/navigation/${m.id}`).subscribe({
        next: () => {
          this.notify(`Deleted menu "${m.title}"`);
          this.loadNavigationMenus();
        },
        error: () => this.notify("Failed to delete menu")
      });
    }
  }

  resetNavMenuDefaults() {
    if (confirm("Reset navigation menus to standard 6 British heating departments (Bathroom Suites, Radiators, Heated Towel Rails, Electric Heating, Valves & Accessories, SALE)? Custom edits will be overwritten.")) {
      this.loadingNavMenus.set(true);
      this.http.post<any[]>("/api/navigation/reset-defaults", {}).pipe(
        finalize(() => this.loadingNavMenus.set(false))
      ).subscribe({
        next: () => {
          this.notify("✓ Navigation reset to default heating departments!");
          this.loadNavigationMenus();
        },
        error: () => this.notify("Failed to reset default menus")
      });
    }
  }

  addSubcategoryItem() {
    if (!this.navMenuDraft.filterOptions) return;
    if (!this.navMenuDraft.filterOptions.subcategories) {
      this.navMenuDraft.filterOptions.subcategories = [];
    }
    this.navMenuDraft.filterOptions.subcategories.push({
      label: "",
      query: "",
      imageUrl: "",
      badge: ""
    });
  }

  removeSubcategoryItem(index: number) {
    if (this.navMenuDraft.filterOptions?.subcategories) {
      this.navMenuDraft.filterOptions.subcategories.splice(index, 1);
    }
  }

  addCustomFilterGroup() {
    if (!this.navMenuDraft.filterOptions) return;
    if (!this.navMenuDraft.filterOptions.customFilters) {
      this.navMenuDraft.filterOptions.customFilters = [];
    }
    this.navMenuDraft.filterOptions.customFilters.push({
      name: "",
      optionsStr: ""
    });
  }

  removeCustomFilterGroup(index: number) {
    if (this.navMenuDraft.filterOptions?.customFilters) {
      this.navMenuDraft.filterOptions.customFilters.splice(index, 1);
    }
  }

  addColumn() {
    if (!this.navMenuDraft.columns) this.navMenuDraft.columns = [];
    this.navMenuDraft.columns.push({
      title: "New Column",
      items: [{ label: "", query: "", category: "", badge: "" }]
    });
  }

  removeColumn(colIndex: number) {
    if (this.navMenuDraft.columns) {
      this.navMenuDraft.columns.splice(colIndex, 1);
    }
  }

  addColumnItem(colIndex: number) {
    if (this.navMenuDraft.columns?.[colIndex]) {
      if (!this.navMenuDraft.columns[colIndex].items) {
        this.navMenuDraft.columns[colIndex].items = [];
      }
      this.navMenuDraft.columns[colIndex].items.push({ label: "", query: "", category: "", badge: "" });
    }
  }

  removeColumnItem(colIndex: number, itemIndex: number) {
    if (this.navMenuDraft.columns?.[colIndex]?.items) {
      this.navMenuDraft.columns[colIndex].items.splice(itemIndex, 1);
    }
  }

  emptyBlog(): AdminBlogPost {
    return {
      slug: '',
      title: '',
      excerpt: '',
      content: '',
      coverImage: '',
      category: 'Buying Guides',
      tags: 'Heating, Radiators, Advice',
      author: 'THP Heating Specialist',
      publishedAt: 'Today',
      status: 'PUBLISHED',
      readTimeMinutes: 5
    };
  }

  loadBlogs() {
    this.loadingBlogs.set(true);
    this.http.get<AdminBlogPost[]>('/api/admin/blogs').pipe(
      finalize(() => this.loadingBlogs.set(false)),
      catchError(e => {
        this.notify(e.error?.message || 'Could not load blogs from admin backend');
        return of([]);
      })
    ).subscribe(list => {
      this.blogs.set(list || []);
    });
  }

  adminBlogCategories = computed(() => {
    const list = this.blogs();
    const set = new Set<string>();
    list.forEach(b => { if (b.category) set.add(b.category.trim()); });
    return Array.from(set);
  });

  filteredAdminBlogs = computed(() => {
    const all = this.blogs();
    const q = this.blogSearchQuery.toLowerCase().trim();
    const cat = this.blogCategoryFilter;
    const stat = this.blogStatusFilter;
    return all.filter(b => {
      const matchQ = !q || (b.title && b.title.toLowerCase().includes(q)) || (b.tags && b.tags.toLowerCase().includes(q)) || (b.category && b.category.toLowerCase().includes(q));
      const matchCat = !cat || (b.category && b.category.toLowerCase() === cat.toLowerCase());
      const matchStat = !stat || (b.status === stat);
      return matchQ && matchCat && matchStat;
    });
  });

  newBlog() {
    this.blogDraft = this.emptyBlog();
    this.modal.set({ type: 'blog', kicker: 'CONTENT & GUIDES', title: 'New Blog Article' });
  }

  editBlog(b: AdminBlogPost) {
    this.blogDraft = { ...b };
    this.modal.set({ type: 'blog', kicker: 'CONTENT & GUIDES', title: 'Edit Blog Article' });
  }

  autoGenerateSlug() {
    if (!this.blogDraft.id && this.blogDraft.title) {
      this.blogDraft.slug = this.blogDraft.title
        .toLowerCase()
        .replace(/[^\w\s-]/g, '')
        .trim()
        .replace(/\s+/g, '-');
    }
  }

  saveBlog() {
    if (!this.blogDraft.title || !this.blogDraft.slug) {
      this.notify('Title and Slug are required');
      return;
    }
    this.savingBlog.set(true);
    const id = this.blogDraft.id;
    this.http.request(id ? 'PUT' : 'POST', id ? `/api/admin/blogs/${id}` : '/api/admin/blogs', { body: this.blogDraft }).pipe(
      finalize(() => this.savingBlog.set(false)),
      catchError(e => {
        this.notify(e.error?.message || 'Failed to save blog');
        return of(null);
      })
    ).subscribe(r => {
      if (r) {
        this.closeModal();
        this.notify(id ? 'Article updated & synced to storefront' : 'Article created & synced to storefront');
        this.loadBlogs();
      }
    });
  }

  toggleBlogStatus(b: AdminBlogPost) {
    const nextStatus = b.status === 'PUBLISHED' ? 'DRAFT' : 'PUBLISHED';
    const updated = { ...b, status: nextStatus };
    this.http.put(`/api/admin/blogs/${b.id}`, updated).subscribe({
      next: () => {
        this.notify(`Status changed to ${nextStatus} & synced to storefront`);
        this.loadBlogs();
      },
      error: (e) => this.notify(e.error?.message || 'Failed to update status')
    });
  }

  deleteBlog(b: AdminBlogPost) {
    if (confirm(`Delete article "${b.title}"? This will remove it from Admin and Storefront.`)) {
      this.http.delete(`/api/admin/blogs/${b.id}`).subscribe({
        next: () => {
          this.notify('Article deleted from admin & storefront');
          this.loadBlogs();
        },
        error: (e) => this.notify(e.error?.message || 'Failed to delete article')
      });
    }
  }

  syncAllBlogsToStorefront() {
    this.syncingAllBlogs.set(true);
    this.http.post<any>('/api/admin/blogs/sync-all', {}).pipe(
      finalize(() => this.syncingAllBlogs.set(false)),
      catchError(e => {
        this.notify(e.error?.message || 'Failed to sync blogs to storefront');
        return of(null);
      })
    ).subscribe(r => {
      if (r) {
        this.notify(`Storefront blog sync complete: ${r.synced} articles synced (${r.failed} failed)`);
        this.loadBlogs();
      }
    });
  }

  loadBanners() {
    this.loadingBanners.set(true);
    this.http.get<any[]>('/api/banners').pipe(
      finalize(() => this.loadingBanners.set(false)),
      catchError(e => {
        this.notify(e.error?.message || 'Could not load storefront banners');
        return of([]);
      })
    ).subscribe(res => {
      this.banners.set(res || []);
    });
  }

  newBanner(type: string = 'BANNER') {
    const list = this.banners();
    const nextOrder = (list.length ? Math.max(...list.map((b: any) => b.sortOrder || 0)) : 0) + 1;
    this.bannerDraft = {
      id: null,
      type: type,
      title: '',
      body: '',
      tag: type === 'CAMPAIGN_BANNER' ? 'DESIGN-LED HEATING' : '✦ BRITISH HEATING & LUXURY BATHROOMS · 2026',
      imageUrl: '',
      buttonText: type === 'CAMPAIGN_BANNER' ? 'Shop Collection →' : 'Explore Heating Range →',
      linkUrl: type === 'CAMPAIGN_BANNER' ? '/category/Radiators' : '#new-arrivals',
      sortOrder: nextOrder,
      status: 'PUBLISHED'
    };
    this.modal.set({
      type: 'banner',
      kicker: type === 'CAMPAIGN_BANNER' ? 'STOREFRONT SECOND CAMPAIGN BANNER' : 'STOREFRONT HERO SLIDER',
      title: type === 'CAMPAIGN_BANNER' ? 'Add Second Campaign Banner' : 'Add Storefront Top Banner'
    });
  }

  editBanner(b: any) {
    this.bannerDraft = { ...b, type: b.type || 'BANNER' };
    this.modal.set({
      type: 'banner',
      kicker: this.bannerDraft.type === 'CAMPAIGN_BANNER' ? 'STOREFRONT SECOND CAMPAIGN BANNER' : 'STOREFRONT HERO SLIDER',
      title: this.bannerDraft.type === 'CAMPAIGN_BANNER' ? 'Edit Second Campaign Banner' : 'Edit Storefront Top Banner'
    });
  }

  saveBanner() {
    if (!this.bannerDraft.title || !this.bannerDraft.title.trim()) {
      this.notify('Banner headline / title is required');
      return;
    }
    this.savingBanner.set(true);
    const id = this.bannerDraft.id;
    this.http.request(id ? 'PUT' : 'POST', id ? `/api/banners/${id}` : '/api/banners', { body: this.bannerDraft }).pipe(
      finalize(() => this.savingBanner.set(false)),
      catchError(e => {
        this.notify(e.error?.message || 'Could not save banner');
        return of(null);
      })
    ).subscribe(res => {
      if (res) {
        this.closeModal();
        this.notify(id ? '✓ Banner updated & synced to Storefront!' : '✓ New banner created & synced to Storefront!');
        this.loadBanners();
      }
    });
  }

  toggleBannerStatus(b: any) {
    if (!b.id) return;
    this.http.post<any>(`/api/banners/${b.id}/toggle-status`, {}).pipe(
      catchError(e => {
        this.notify(e.error?.message || 'Could not update status');
        return of(null);
      })
    ).subscribe(res => {
      if (res) {
        this.notify(`Banner is now ${res.status} (synced to storefront)`);
        this.loadBanners();
      }
    });
  }

  deleteBanner(b: any) {
    if (!b.id) return;
    if (!confirm(`Delete banner "${b.title}"? This will remove it from the Storefront hero slider.`)) return;
    this.http.delete<any>(`/api/banners/${b.id}`).pipe(
      catchError(e => {
        this.notify(e.error?.message || 'Could not delete banner');
        return of(null);
      })
    ).subscribe(() => {
      this.notify(`Deleted banner "${b.title}"`);
      this.loadBanners();
    });
  }

  syncAllBannersToStorefront() {
    this.syncingBanners.set(true);
    this.http.get<any[]>('/api/banners').pipe(
      finalize(() => this.syncingBanners.set(false)),
      catchError(e => {
        this.notify(e.error?.message || 'Sync failed');
        return of(null);
      })
    ).subscribe(res => {
      if (res) {
        this.banners.set(res);
        this.notify('⚡ All storefront banners & campaigns synced dynamically!');
      }
    });
  }

  // ==========================================
  // BANNER & MEDIA IMAGE CROPPING FUNCTIONALITY
  // ==========================================
  cropModalActive = signal<boolean>(false);
  croppingImage = signal<boolean>(false);
  cropAspectRatio: '16:6' | '16:7' | '16:9' | '21:9' = '16:6';
  cropTargetType: 'banner' | 'navCategory' = 'banner';
  cropImageSrc: string = '';
  cropZoom: number = 1.0;
  cropPanX: number = 0;
  cropPanY: number = 0;
  private isDraggingCrop: boolean = false;
  private dragStartX: number = 0;
  private dragStartY: number = 0;
  private panStartX: number = 0;
  private panStartY: number = 0;

  onBannerFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    if (file.size > 15 * 1024 * 1024) {
      this.notify('Selected image must be under 15MB');
      input.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      if (dataUrl) {
        this.openCropModal(dataUrl, 'banner');
      }
      input.value = '';
    };
    reader.readAsDataURL(file);
  }

  cropExistingBanner() {
    if (!this.bannerDraft.imageUrl) return;
    this.openCropModal(this.bannerDraft.imageUrl, 'banner');
  }

  cropExistingNavImage() {
    if (!this.navMenuDraft.imageUrl) return;
    this.openCropModal(this.navMenuDraft.imageUrl, 'navCategory');
  }

  onNavCategoryFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      if (dataUrl) {
        this.openCropModal(dataUrl, 'navCategory');
      }
      input.value = '';
    };
    reader.readAsDataURL(file);
  }

  openCropModal(src: string, targetType: 'banner' | 'navCategory' = 'banner') {
    this.cropImageSrc = src;
    this.cropTargetType = targetType;
    this.cropZoom = 1.0;
    this.cropPanX = 0;
    this.cropPanY = 0;
    this.cropAspectRatio = targetType === 'banner' ? (this.bannerDraft.type === 'CAMPAIGN_BANNER' ? '16:9' : '16:6') : '16:9';
    this.cropModalActive.set(true);
  }

  closeCropModal() {
    this.cropModalActive.set(false);
    this.cropImageSrc = '';
    this.cropZoom = 1.0;
    this.cropPanX = 0;
    this.cropPanY = 0;
  }

  setCropAspectRatio(ratio: '16:6' | '16:7' | '16:9' | '21:9') {
    this.cropAspectRatio = ratio;
    this.resetCropTransform();
  }

  getCssAspectRatio(): string {
    switch (this.cropAspectRatio) {
      case '16:6': return '16 / 6';
      case '16:7': return '16 / 7';
      case '16:9': return '16 / 9';
      case '21:9': return '21 / 9';
      default: return '16 / 6';
    }
  }

  getNumericAspectRatio(): number {
    switch (this.cropAspectRatio) {
      case '16:6': return 16 / 6;
      case '16:7': return 16 / 7;
      case '16:9': return 16 / 9;
      case '21:9': return 21 / 9;
      default: return 16 / 6;
    }
  }

  onCropMouseDown(e: MouseEvent) {
    e.preventDefault();
    this.isDraggingCrop = true;
    this.dragStartX = e.clientX;
    this.dragStartY = e.clientY;
    this.panStartX = this.cropPanX;
    this.panStartY = this.cropPanY;
  }

  onCropMouseMove(e: MouseEvent) {
    if (!this.isDraggingCrop) return;
    this.cropPanX = this.panStartX + (e.clientX - this.dragStartX);
    this.cropPanY = this.panStartY + (e.clientY - this.dragStartY);
  }

  onCropMouseUp() {
    this.isDraggingCrop = false;
  }

  resetCropTransform() {
    this.cropZoom = 1.0;
    this.cropPanX = 0;
    this.cropPanY = 0;
  }

  applyCropAndUpload() {
    const viewport = document.getElementById('banner-crop-viewport');
    if (!viewport || !this.cropImageSrc) return;
    this.croppingImage.set(true);

    let targetWidth = 1920;
    let targetHeight = Math.round(targetWidth / this.getNumericAspectRatio());
    if (this.cropAspectRatio === '16:9') {
      targetWidth = 1600;
      targetHeight = 900;
    }

    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      this.croppingImage.set(false);
      return;
    }

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const vpRect = viewport.getBoundingClientRect();
      const vpWidth = vpRect.width;
      const vpHeight = vpRect.height;

      const scaleX = targetWidth / vpWidth;
      const scaleY = targetHeight / vpHeight;

      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, targetWidth, targetHeight);

      const imgAspect = img.naturalWidth / img.naturalHeight;
      const vpAspect = vpWidth / vpHeight;

      let baseDrawWidth = vpWidth;
      let baseDrawHeight = vpHeight;

      if (imgAspect > vpAspect) {
        baseDrawHeight = vpHeight;
        baseDrawWidth = vpHeight * imgAspect;
      } else {
        baseDrawWidth = vpWidth;
        baseDrawHeight = vpWidth / imgAspect;
      }

      const zoomedWidth = baseDrawWidth * this.cropZoom;
      const zoomedHeight = baseDrawHeight * this.cropZoom;

      const centerX = (vpWidth / 2) + this.cropPanX;
      const centerY = (vpHeight / 2) + this.cropPanY;

      const drawX = (centerX - (zoomedWidth / 2)) * scaleX;
      const drawY = (centerY - (zoomedHeight / 2)) * scaleY;
      const drawW = zoomedWidth * scaleX;
      const drawH = zoomedHeight * scaleY;

      ctx.drawImage(img, drawX, drawY, drawW, drawH);

      canvas.toBlob((blob) => {
        if (!blob) {
          this.croppingImage.set(false);
          this.notify('Failed to generate cropped image');
          return;
        }

        const file = new File([blob], `banner-crop-${Date.now()}.jpg`, { type: 'image/jpeg' });
        const form = new FormData();
        form.append('file', file);

        this.http.post<{url: string; filename: string}>('/api/products/images', form).pipe(
          finalize(() => this.croppingImage.set(false)),
          catchError(err => {
            this.notify(err.error?.message || 'Banner upload failed');
            return of(null);
          })
        ).subscribe(res => {
          if (res && res.url) {
            if (this.cropTargetType === 'banner') {
              this.bannerDraft.imageUrl = res.url;
              this.notify('✓ Banner cropped & uploaded successfully!');
            } else if (this.cropTargetType === 'navCategory') {
              this.navMenuDraft.imageUrl = res.url;
              this.notify('✓ Category image cropped & uploaded successfully!');
            }
            this.closeCropModal();
          }
        });
      }, 'image/jpeg', 0.92);
    };
    img.onerror = () => {
      this.croppingImage.set(false);
      this.notify('Could not load image for cropping');
    };
    img.src = this.cropImageSrc;
  }

 private emptyProduct():Product{return{sku:'',name:'',brand:'Terma',category:'Designer Radiators',description:'',priceMinor:0,costMinor:0,stock:10,lowStockThreshold:5,discountPercent:0,status:'PUBLISHED',taxClass:'STANDARD',shippingClass:'STANDARD',variants:[]}}
}

bootstrapApplication(App,{providers:[provideHttpClient(withInterceptors([authInterceptor]))]}).catch(console.error);
