'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import {
    ArrowLeft,
    Heart,
    Share2,
    MessageCircle,
    ChevronLeft,
    ChevronRight,
    Loader2,
    Package,
} from 'lucide-react';
import Link from 'next/link';

interface ProductCategory {
    id: string;
    name: string;
    color: string;
}

interface Product {
    id: string;
    name: string;
    description: string | null;
    price: number | null;
    currency: string;
    image_url: string | null;
    category_id: string | null;
    category: ProductCategory | null;
    is_active: boolean;
}

interface Variation {
    id: string;
    variation_type: { name: string };
    value: string;
    price: number;
}

export default function ProductDetailPage() {
    const params = useParams();
    const [product, setProduct] = useState<Product | null>(null);
    const [variations, setVariations] = useState<Variation[]>([]);
    const [relatedProducts, setRelatedProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedImageIndex, setSelectedImageIndex] = useState(0);
    const [isWishlisted, setIsWishlisted] = useState(false);
    const [selectedVariations, setSelectedVariations] = useState<Record<string, string>>({});
    const [currentPrice, setCurrentPrice] = useState<number | null>(null);

    const [facebookPageId, setFacebookPageId] = useState<string | null>(null);

    // Simulate multiple images for the gallery (using same image for demo)
    const productImages = product?.image_url
        ? [product.image_url]
        : [];

    useEffect(() => {
        if (params.id) {
            fetchProductData();
        }
        fetchConnectedPages();
    }, [params.id]);

    const fetchConnectedPages = async () => {
        try {
            const res = await fetch('/api/facebook/pages');
            const data = await res.json();
            if (data.pages && data.pages.length > 0) {
                // Use the first connected page
                setFacebookPageId(data.pages[0].page_id);
            }
        } catch (error) {
            console.error('Failed to fetch connected pages:', error);
        }
    };

    const fetchProductData = async () => {
        setLoading(true);
        try {
            // Fetch product
            const productRes = await fetch('/api/products');
            const productsData = await productRes.json();

            if (Array.isArray(productsData)) {
                const foundProduct = productsData.find((p: Product) => p.id === params.id);
                setProduct(foundProduct || null);

                if (foundProduct) {
                    setCurrentPrice(foundProduct.price);

                    // Fetch variations
                    const variationsRes = await fetch(`/api/product-variations?productId=${foundProduct.id}`);
                    const variationsData = await variationsRes.json();
                    if (Array.isArray(variationsData) && variationsData.length > 0) {
                        setVariations(variationsData);

                        // Set default selections (first option of each type)
                        const defaults: Record<string, string> = {};
                        let defaultPrice = foundProduct.price;

                        // Group first to find unique types
                        const types = new Set(variationsData.map((v: any) => v.variation_type.name));

                        types.forEach(typeName => {
                            // Find the first variation for this type
                            const firstVar = variationsData.find((v: any) => v.variation_type.name === typeName);
                            if (firstVar) {
                                defaults[typeName] = firstVar.value;
                                // Update price to the first variation's price
                                // Logic: If multiple types exist, this simple logic takes the price of the last processed type's first option
                                // For better logic with multiple types, we might need a combined price strategy or just pick one
                                if (firstVar.price > 0) {
                                    defaultPrice = firstVar.price;
                                }
                            }
                        });

                        setSelectedVariations(defaults);
                        if (defaultPrice) setCurrentPrice(defaultPrice);
                    } else if (Array.isArray(variationsData)) {
                        setVariations([]);
                    }

                    // Fetch related products
                    const related = productsData
                        .filter((p: Product) => p.id !== params.id && p.category_id === foundProduct.category_id)
                        .slice(0, 4);
                    setRelatedProducts(related);
                }
            }
        } catch (error) {
            console.error('Failed to fetch data:', error);
        } finally {
            setLoading(false);
        }
    };

    const formatPrice = (price: number | null) => {
        if (price === null) return 'Price not set';
        return `₱${price.toLocaleString('en-PH', { minimumFractionDigits: 2 })}`;
    };

    // Group variations by type
    const groupedVariations = variations.reduce((acc, variation) => {
        const typeName = variation.variation_type.name;
        if (!acc[typeName]) {
            acc[typeName] = [];
        }
        acc[typeName].push(variation);
        return acc;
    }, {} as Record<string, Variation[]>);

    const handleVariationSelect = (typeName: string, variation: Variation) => {
        setSelectedVariations(prev => ({
            ...prev,
            [typeName]: variation.value
        }));

        // Update price based on selection
        // If strict combination logic is needed, we'd look for the specific combination
        // For now, let's just use the selected variation's price if specific logic applies
        if (variation.price > 0) {
            setCurrentPrice(variation.price);
        }
    };

    const handleChatToBuy = () => {
        if (!product) return;

        // Check if a page is connected
        if (!facebookPageId) {
            alert('Store messenging is not configured. Please contact the administrator.');
            return;
        }

        // Check if all variations are selected
        const unselectedTypes = Object.keys(groupedVariations).filter(type => !selectedVariations[type]);
        if (unselectedTypes.length > 0) {
            alert(`Please select ${unselectedTypes.join(', ')} before chatting to buy.`);
            return;
        }

        // Construct ref payload
        // Format: p_id:123|var:Size-M,Color-Red
        const variationString = Object.entries(selectedVariations)
            .map(([key, value]) => `${key}-${value}`)
            .join(',');

        const refPayload = `p_id:${product.id}|vars:${variationString}`;

        const mmeUrl = `https://m.me/${facebookPageId}?ref=${encodeURIComponent(refPayload)}`;
        window.open(mmeUrl, '_blank');
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-white flex items-center justify-center">
                <div className="text-center">
                    <Loader2 className="animate-spin mx-auto mb-4 text-emerald-500" size={40} />
                    <p className="text-gray-500">Loading product...</p>
                </div>
            </div>
        );
    }

    if (!product) {
        return (
            <div className="min-h-screen bg-white flex items-center justify-center">
                <div className="text-center">
                    <Package className="mx-auto mb-4 text-gray-300" size={64} />
                    <h2 className="text-xl font-semibold text-gray-900 mb-2">Product not found</h2>
                    <p className="text-gray-500 mb-6">The product you're looking for doesn't exist.</p>
                    <Link
                        href="/store"
                        className="inline-flex items-center gap-2 px-6 py-3 bg-emerald-500 text-white rounded-full hover:bg-emerald-600 transition-colors font-medium"
                    >
                        <ArrowLeft size={18} />
                        Back to Store
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-white">
            {/* Main Content */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Breadcrumb */}
                <nav className="flex items-center gap-2 text-sm mb-8">
                    <Link href="/store" className="text-gray-500 hover:text-emerald-600 transition-colors">
                        Store
                    </Link>
                    <span className="text-gray-400">/</span>
                    {product.category && (
                        <>
                            <span className="text-gray-500">
                                {product.category.name}
                            </span>
                            <span className="text-gray-400">/</span>
                        </>
                    )}
                    <span className="text-gray-900 font-medium truncate max-w-xs">
                        {product.name}
                    </span>
                </nav>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 mb-16">
                    {/* Left Column - Product Images */}
                    <div className="space-y-4">
                        {/* Main Image */}
                        <div className="relative aspect-square bg-gray-50 rounded-3xl overflow-hidden group border border-gray-100">
                            {productImages.length > 0 ? (
                                <img
                                    src={productImages[selectedImageIndex]}
                                    alt={product.name}
                                    className="w-full h-full object-contain p-4"
                                />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                    <Package size={80} className="text-gray-300" />
                                </div>
                            )}

                            {/* Image Navigation Arrows */}
                            {productImages.length > 1 && (
                                <>
                                    <button
                                        onClick={() => setSelectedImageIndex(prev =>
                                            prev === 0 ? productImages.length - 1 : prev - 1
                                        )}
                                        className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center shadow-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white"
                                    >
                                        <ChevronLeft size={20} className="text-gray-700" />
                                    </button>
                                    <button
                                        onClick={() => setSelectedImageIndex(prev =>
                                            prev === productImages.length - 1 ? 0 : prev + 1
                                        )}
                                        className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center shadow-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white"
                                    >
                                        <ChevronRight size={20} className="text-gray-700" />
                                    </button>
                                </>
                            )}
                        </div>

                        {/* Thumbnail Gallery */}
                        {productImages.length > 1 && (
                            <div className="flex gap-3">
                                {productImages.map((img, index) => (
                                    <button
                                        key={index}
                                        onClick={() => setSelectedImageIndex(index)}
                                        className={`relative w-20 h-20 rounded-xl overflow-hidden border-2 transition-all ${selectedImageIndex === index
                                            ? 'border-emerald-500 ring-2 ring-emerald-500/20'
                                            : 'border-transparent hover:border-gray-300'
                                            }`}
                                    >
                                        <img
                                            src={img}
                                            alt={`${product.name} view ${index + 1}`}
                                            className="w-full h-full object-cover"
                                        />
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Right Column - Product Info */}
                    <div className="space-y-8">
                        {/* Title & Description */}
                        <div>
                            <div className="flex items-start justify-between">
                                <h1 className="text-3xl font-bold text-gray-900 mb-3 leading-tight">
                                    {product.name}
                                </h1>
                            </div>
                            {product.category && (
                                <div className="inline-block px-3 py-1 rounded-full text-xs font-medium mb-4" style={{ backgroundColor: `${product.category.color}20`, color: product.category.color }}>
                                    {product.category.name}
                                </div>
                            )}
                            {product.description && (
                                <p className="text-gray-600 leading-relaxed text-lg">
                                    {product.description}
                                </p>
                            )}
                        </div>

                        {/* Price */}
                        <div className="flex items-baseline gap-3 pb-6 border-b border-gray-100">
                            <span className="text-4xl font-bold text-emerald-600">
                                {formatPrice(currentPrice)}
                            </span>
                        </div>

                        {/* Variations Selection */}
                        {Object.keys(groupedVariations).length > 0 && (
                            <div className="space-y-6">
                                {Object.entries(groupedVariations).map(([typeName, vars]) => (
                                    <div key={typeName}>
                                        <div className="flex items-center gap-2 mb-3">
                                            <span className="text-sm font-semibold text-gray-900">{typeName}:</span>
                                            <span className="text-sm text-gray-500">{selectedVariations[typeName]}</span>
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                            {vars.map((variation) => {
                                                const isSelected = selectedVariations[typeName] === variation.value;
                                                return (
                                                    <button
                                                        key={variation.id}
                                                        onClick={() => handleVariationSelect(typeName, variation)}
                                                        className={`min-w-[48px] px-4 py-2.5 rounded-lg text-sm font-medium transition-all border ${isSelected
                                                            ? 'bg-gray-900 text-white border-gray-900 shadow-md transform scale-105'
                                                            : 'bg-white text-gray-700 border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                                                            }`}
                                                    >
                                                        {variation.value}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Action Buttons */}
                        <div className="flex items-center gap-4 pt-4">
                            <button
                                onClick={handleChatToBuy}
                                className="flex-1 bg-gray-900 text-white px-8 py-4 rounded-full font-semibold hover:bg-gray-800 transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 active:translate-y-0 text-lg flex items-center justify-center gap-2"
                            >
                                <MessageCircle size={20} />
                                Chat to Buy
                            </button>
                            <button
                                onClick={() => setIsWishlisted(!isWishlisted)}
                                className={`p-4 rounded-full border transition-all ${isWishlisted
                                    ? 'border-red-200 bg-red-50 text-red-500'
                                    : 'border-gray-200 hover:border-gray-300 text-gray-600 hover:bg-gray-50'
                                    }`}
                            >
                                <Heart size={24} className={isWishlisted ? 'fill-current' : ''} />
                            </button>
                            <button className="p-4 rounded-full border border-gray-200 hover:border-gray-300 text-gray-600 hover:bg-gray-50 transition-all">
                                <Share2 size={24} />
                            </button>
                        </div>
                    </div>
                </div>

                {/* Related Products */}
                {relatedProducts.length > 0 && (
                    <div className="mt-16 pt-16 border-t border-gray-100">
                        <h2 className="text-2xl font-bold text-gray-900 mb-8">You May Also Like</h2>
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                            {relatedProducts.map((relatedProduct) => (
                                <Link
                                    key={relatedProduct.id}
                                    href={`/product/${relatedProduct.id}`}
                                    className="group"
                                >
                                    <div className="relative aspect-[3/4] bg-gray-50 rounded-2xl overflow-hidden mb-3 border border-gray-100">
                                        {relatedProduct.image_url ? (
                                            <img
                                                src={relatedProduct.image_url}
                                                alt={relatedProduct.name}
                                                className="w-full h-full object-contain p-4 group-hover:scale-105 transition-transform duration-500"
                                            />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center">
                                                <Package size={32} className="text-gray-300" />
                                            </div>
                                        )}
                                        {relatedProduct.category && (
                                            <div className="absolute top-3 left-3 px-2 py-1 bg-white/90 backdrop-blur text-xs font-medium rounded-md shadow-sm text-gray-900">
                                                {relatedProduct.category.name}
                                            </div>
                                        )}
                                    </div>
                                    <h3 className="font-medium text-gray-900 truncate group-hover:text-emerald-600 transition-colors">
                                        {relatedProduct.name}
                                    </h3>
                                    <div className="flex items-baseline gap-2 mt-1">
                                        <span className="font-bold text-gray-900">
                                            {formatPrice(relatedProduct.price)}
                                        </span>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
