import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authService } from '../services';
import { useAuthStore } from '../store';

const VIEW_KEYS = {
    profile: 'profile',
    orders: 'orders',
    editProfile: 'editProfile',
    shipping: 'shipping',
    reviews: 'reviews',
    points: 'points',
};

function emptyProfile(user) {
    return {
        full_name: user?.full_name || '',
        username: user?.username || '',
        email: user?.email || '',
        avatar_url: user?.avatar_url || '',
        phone: user?.phone || '',
        date_of_birth: '',
        bio: '',
        address_line_1: '',
        address_line_2: '',
        city: '',
        state: '',
        postal_code: '',
        country: 'United States',
        preferred_category: 'Electronics',
        notification_email: true,
        notification_sms: false,
    };
}

function IconTile({ icon, label, tone = 'bg-slate-100 text-slate-700', onClick }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className="flex flex-col items-center gap-2 rounded-2xl p-2 text-center transition hover:-translate-y-0.5"
        >
            <div className={`flex h-12 w-12 items-center justify-center rounded-full text-lg shadow-sm ${tone}`}>
                {icon}
            </div>
            <span className="text-[11px] font-medium text-slate-700">{label}</span>
        </button>
    );
}

export function ProfilePage() {
    const navigate = useNavigate();
    const { user, setUser, logout } = useAuthStore();
    const [view, setView] = useState(VIEW_KEYS.profile);
    const [message, setMessage] = useState('Tap Edit Profile or Shipping Address to update and save to Supabase.');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [profileForm, setProfileForm] = useState(emptyProfile(user));

    const ordersSummary = useMemo(() => ([
        { label: 'Pending Payment', icon: '💳', tone: 'bg-sky-50 text-sky-600', count: 4 },
        { label: 'Delivered', icon: '🚚', tone: 'bg-amber-50 text-amber-500', count: 12 },
        { label: 'Processing', icon: '🛍️', tone: 'bg-rose-50 text-rose-500', count: 3 },
        { label: 'Cancelled', icon: '📦', tone: 'bg-emerald-50 text-emerald-600', count: 1 },
        { label: 'Wishlist', icon: '❤️', tone: 'bg-pink-50 text-pink-500', count: 8 },
        { label: 'Customer Care', icon: '🎧', tone: 'bg-violet-50 text-violet-600', count: 0 },
    ]), []);

    const reviewHistory = useMemo(() => ([
        {
            name: 'Wireless Smartwatch Series 8',
            subtitle: 'Aluminum case and comfort sport band',
            purchasedOn: '12 Jul 2023',
            rating: 4,
        },
        {
            name: 'Noise Cancelling Headphones Pro',
            subtitle: 'Deep bass with active noise cancellation',
            purchasedOn: '01 Aug 2023',
            rating: 5,
        },
    ]), []);

    useEffect(() => {
        let isMounted = true;

        const loadProfile = async () => {
            try {
                setLoading(true);
                const data = await authService.getProfile();
                if (!isMounted) {
                    return;
                }

                const profile = data?.profile || {};
                setProfileForm((prev) => ({
                    ...prev,
                    ...profile,
                    full_name: profile.full_name || user?.full_name || prev.full_name,
                    username: profile.username || user?.username || prev.username,
                    email: profile.email || user?.email || prev.email,
                }));

                if (profile?.id || profile?.email) {
                    const mergedUser = { ...(user || {}), ...profile };
                    if (JSON.stringify(mergedUser) !== JSON.stringify(user || {})) {
                        setUser(mergedUser);
                    }
                }
            } catch (_error) {
                if (isMounted) {
                    setMessage('Profile loaded locally. Save to write the data to Supabase.');
                }
            } finally {
                if (isMounted) {
                    setLoading(false);
                }
            }
        };

        loadProfile();

        return () => {
            isMounted = false;
        };
    }, [setUser]);

    const initials = (profileForm.full_name || profileForm.username || profileForm.email || 'U')
        .split(' ')
        .map((part) => part[0])
        .join('')
        .slice(0, 2)
        .toUpperCase();

    const updateField = (field, value) => {
        setProfileForm((prev) => ({ ...prev, [field]: value }));
    };

    const saveProfile = async () => {
        try {
            setSaving(true);
            const response = await authService.updateProfile(profileForm);
            const profile = response?.profile || {};
            setProfileForm((prev) => ({ ...prev, ...profile }));
            setUser({ ...user, ...profile });
            setMessage('Profile saved to Supabase.');
        } catch (error) {
            setMessage(error?.response?.data?.detail || error.message || 'Unable to save profile.');
        } finally {
            setSaving(false);
        }
    };

    const sideMenu = [
        { label: 'Dashboard', key: VIEW_KEYS.profile, icon: '⌂' },
        { label: 'Order History', key: VIEW_KEYS.orders, icon: '🧾' },
        { label: 'Account Details', key: VIEW_KEYS.editProfile, icon: '👤' },
        { label: 'Address', key: VIEW_KEYS.shipping, icon: '📍' },
        { label: 'To Review', key: VIEW_KEYS.reviews, icon: '★' },
        { label: 'Rewards', key: VIEW_KEYS.points, icon: '🎁' },
        { label: 'Logout', key: 'logout', icon: '↩' },
    ];

    const openView = (key) => {
        if (key === 'logout') {
            logout();
            navigate('/login');
            return;
        }

        setView(key);

        if (key === VIEW_KEYS.orders) {
            navigate('/orders');
            return;
        }

        setMessage(`${key === VIEW_KEYS.editProfile ? 'Edit Profile' : key === VIEW_KEYS.shipping ? 'Shipping Address' : key === VIEW_KEYS.reviews ? 'Wishlist' : 'Section'} opened.`);
    };

    const backToProfile = () => {
        setView(VIEW_KEYS.profile);
        setMessage('Profile overview opened.');
    };

    const menuButtonClass = (key) => {
        const active = view === key;
        return `flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm transition ${active ? 'bg-sky-100 text-sky-700' : 'text-slate-600 hover:bg-slate-100'}`;
    };

    const renderSectionHeader = (title) => (
        <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-3">
            <h2 className="text-base font-semibold text-slate-800">{title}</h2>
            {view !== VIEW_KEYS.profile ? (
                <button type="button" onClick={backToProfile} className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50">
                    Back
                </button>
            ) : null}
        </div>
    );

    const renderContent = () => {
        if (loading) {
            return <div className="rounded-[2rem] bg-white p-6 text-center text-slate-500 shadow-sm">Loading profile...</div>;
        }

        if (view === VIEW_KEYS.editProfile) {
            return (
                <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
                    {renderSectionHeader('Account Details')}

                    <div className="space-y-4">
                        <label className="block space-y-1">
                            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Full Name *</span>
                            <input value={profileForm.full_name} onChange={(e) => updateField('full_name', e.target.value)} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-rose-400" />
                        </label>

                        <label className="block space-y-1">
                            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Username *</span>
                            <input value={profileForm.username} onChange={(e) => updateField('username', e.target.value)} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-rose-400" />
                        </label>

                        <label className="block space-y-1">
                            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Email *</span>
                            <input type="email" value={profileForm.email} onChange={(e) => updateField('email', e.target.value)} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-rose-400" />
                        </label>

                        <label className="block space-y-1">
                            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Phone Number</span>
                            <input value={profileForm.phone} onChange={(e) => updateField('phone', e.target.value)} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-rose-400" />
                        </label>

                        <label className="block space-y-1">
                            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Bio</span>
                            <textarea value={profileForm.bio} onChange={(e) => updateField('bio', e.target.value)} rows="3" className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-rose-400" />
                        </label>

                        <button type="button" onClick={saveProfile} disabled={saving} className="mt-2 w-full rounded-2xl bg-rose-600 px-4 py-3 text-sm font-semibold text-white shadow-sm disabled:opacity-60">
                            {saving ? 'Saving...' : 'Save Profile'}
                        </button>
                    </div>
                </div>
            );
        }

        if (view === VIEW_KEYS.shipping) {
            return (
                <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
                    {renderSectionHeader('Address')}

                    <div className="space-y-4">
                        <label className="block space-y-1">
                            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Address Line 1 *</span>
                            <input value={profileForm.address_line_1} onChange={(e) => updateField('address_line_1', e.target.value)} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-rose-400" />
                        </label>

                        <label className="block space-y-1">
                            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Address Line 2</span>
                            <input value={profileForm.address_line_2} onChange={(e) => updateField('address_line_2', e.target.value)} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-rose-400" />
                        </label>

                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            <label className="block space-y-1">
                                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">City *</span>
                                <input value={profileForm.city} onChange={(e) => updateField('city', e.target.value)} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-rose-400" />
                            </label>
                            <label className="block space-y-1">
                                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">State *</span>
                                <input value={profileForm.state} onChange={(e) => updateField('state', e.target.value)} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-rose-400" />
                            </label>
                        </div>

                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            <label className="block space-y-1">
                                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Postal Code *</span>
                                <input value={profileForm.postal_code} onChange={(e) => updateField('postal_code', e.target.value)} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-rose-400" />
                            </label>
                            <label className="block space-y-1">
                                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Country *</span>
                                <input value={profileForm.country} onChange={(e) => updateField('country', e.target.value)} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-rose-400" />
                            </label>
                        </div>

                        <button type="button" onClick={saveProfile} disabled={saving} className="mt-2 w-full rounded-2xl bg-rose-600 px-4 py-3 text-sm font-semibold text-white shadow-sm disabled:opacity-60">
                            {saving ? 'Saving...' : 'Save Shipping Address'}
                        </button>
                    </div>
                </div>
            );
        }

        if (view === VIEW_KEYS.reviews) {
            return (
                <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
                    {renderSectionHeader('Review History')}

                    <div className="space-y-3">
                        {reviewHistory.map((item) => (
                            <article key={item.name} className="rounded-xl border border-slate-200 p-4">
                                <div className="flex items-start justify-between gap-3">
                                    <div>
                                        <p className="text-sm font-semibold text-slate-900">{item.name}</p>
                                        <p className="text-xs text-slate-500">{item.subtitle}</p>
                                        <p className="mt-2 text-xs text-slate-500">Purchased on {item.purchasedOn}</p>
                                    </div>
                                    <button type="button" className="rounded-md bg-sky-600 px-3 py-1 text-xs font-semibold text-white hover:bg-sky-700">Edit Review</button>
                                </div>
                                <p className="mt-3 text-xs text-amber-500">{'★'.repeat(item.rating)}{'☆'.repeat(5 - item.rating)}</p>
                                <p className="mt-2 text-xs text-slate-600">Great build quality and smooth experience. Writing review from profile page works correctly.</p>
                            </article>
                        ))}
                    </div>
                </div>
            );
        }

        if (view === VIEW_KEYS.points) {
            return (
                <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
                    {renderSectionHeader('Rewards & Settings')}

                    <div className="grid grid-cols-2 gap-3 text-center sm:grid-cols-3">
                        <div className="rounded-2xl bg-sky-50 p-3">
                            <p className="text-lg">⚙️</p>
                            <p className="mt-1 text-xs text-slate-700">Account</p>
                        </div>
                        <div className="rounded-2xl bg-amber-50 p-3">
                            <p className="text-lg">🔔</p>
                            <p className="mt-1 text-xs text-slate-700">Alerts</p>
                        </div>
                        <div className="rounded-2xl bg-emerald-50 p-3">
                            <p className="text-lg">🎁</p>
                            <p className="mt-1 text-xs text-slate-700">Rewards</p>
                        </div>
                    </div>
                </div>
            );
        }

        return (
            <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
                {renderSectionHeader('My Account')}

                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
                    {ordersSummary.map((item) => (
                        <IconTile
                            key={item.label}
                            icon={`${item.icon}${item.count ? ` ${item.count}` : ''}`}
                            label={item.label}
                            tone={item.tone}
                            onClick={() => {
                                if (item.label === 'Customer Care') {
                                    setMessage('Customer care section opened.');
                                    return;
                                }
                                navigate('/orders');
                            }}
                        />
                    ))}
                </div>

                <div className="mt-5 rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                    {message}
                </div>
            </div>
        );
    };

    return (
        <section className="mx-auto w-full max-w-6xl px-3 py-4 sm:px-6 sm:py-6">
            <div className="rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
                <div className="rounded-t-2xl bg-[radial-gradient(circle_at_top_right,_rgba(14,165,233,0.4),_rgba(37,99,235,0.95)_45%,_rgba(3,105,161,0.95))] px-5 py-8 text-white sm:px-8">
                    <h1 className="text-2xl font-bold">My Account</h1>
                    <p className="mt-1 text-sm text-white/80">Manage profile, address, orders, and review history</p>
                </div>

                <div className="grid gap-5 p-4 sm:p-6 lg:grid-cols-[280px_1fr]">
                    <aside className="order-2 rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-100 lg:order-1">
                        <div className="mb-5 flex items-center gap-3">
                            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-200 font-bold text-slate-700">
                                {initials}
                            </div>
                            <div>
                                <p className="text-sm font-semibold text-slate-800">{profileForm.full_name || user?.full_name || 'Jenny Wilson'}</p>
                                <p className="text-xs text-slate-500">{profileForm.email || user?.email || 'shopper@demo.com'}</p>
                            </div>
                        </div>

                        <nav className="space-y-1">
                            {sideMenu.map((item) => (
                                <button
                                    key={item.key}
                                    type="button"
                                    onClick={() => openView(item.key)}
                                    className={menuButtonClass(item.key)}
                                >
                                    <span className="w-5 text-center">{item.icon}</span>
                                    <span>{item.label}</span>
                                </button>
                            ))}
                        </nav>
                    </aside>

                    <div className="order-1 lg:order-2">
                        {renderContent()}

                        <div className="mt-4 text-right text-xs text-slate-500">
                            <Link to="/orders" className="hover:text-sky-600">View full catalog</Link>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}