import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { User, MapPin, Plus, Edit2, Trash2, History, LogOut, Wallet, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/hooks/useAuth";
import { useWallet } from "@/hooks/useWallet";
import { useReferral } from "@/hooks/useReferral";
import { supabase } from "@/integrations/supabase/client";
import { signOut } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { formatPrice } from "@/lib/priceCalculation";
import CargoCard from "@/components/cargo/CargoCard";
import BranchSelector from "@/components/profile/BranchSelector";
import type { DeliveryAddress, Cargo, CargoStatus } from "@/types/cargo";

export default function Profile() {
  const { user, profile, isLoading: authLoading, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { balance, isLoading: walletLoading } = useWallet();
  const { totalReferrals, totalRewards, isLoading: referralLoading } = useReferral();
  const [addresses, setAddresses] = useState<DeliveryAddress[]>([]);
  const [cargoHistory, setCargoHistory] = useState<Cargo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showHistory, setShowHistory] = useState(false);

  // Profile edit state
  const [fullName, setFullName] = useState("");
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Address form state
  const [addressDialogOpen, setAddressDialogOpen] = useState(false);
  const [editingAddress, setEditingAddress] = useState<DeliveryAddress | null>(null);
  const [addressForm, setAddressForm] = useState({
    label: "",
    address_line: "",
    city: "Улаанбаатар",
    district: "",
    phone: "",
  });

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
      return;
    }

    if (user) {
      fetchData();
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || "");
    }
  }, [profile]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      // Fetch addresses
      const { data: addressData } = await supabase
        .from("delivery_addresses")
        .select("*")
        .order("is_default", { ascending: false });

      if (addressData) {
        setAddresses(addressData as DeliveryAddress[]);
      }

      // Fetch cargo history
      if (profile?.phone) {
        const { data: historyData } = await supabase
          .from("cargo")
          .select("*")
          .eq("phone_number", profile.phone)
          .eq("status", "completed")
          .order("updated_at", { ascending: false })
          .limit(20);

        if (historyData) {
          const transformedData: Cargo[] = (historyData || []).map((item) => ({
            ...item,
            status: item.status as CargoStatus,
          }));
          setCargoHistory(transformedData);
        }
      }
    } catch (error) {
      console.error("Failed to fetch data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateProfile = async () => {
    if (!user) return;

    setIsSaving(true);
    try {
      const { error } = await supabase.from("profiles").update({ full_name: fullName }).eq("id", user.id);

      if (error) throw error;

      await refreshProfile();
      setIsEditingProfile(false);
      toast({ title: "Амжилттай", description: "Профайл шинэчлэгдлээ" });
    } catch (error) {
      toast({ title: "Алдаа", description: "Хадгалж чадсангүй", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveAddress = async () => {
    if (!user) return;

    setIsSaving(true);
    try {
      if (editingAddress) {
        const { error } = await supabase.from("delivery_addresses").update(addressForm).eq("id", editingAddress.id);

        if (error) throw error;
      } else {
        const { error } = await supabase.from("delivery_addresses").insert({ ...addressForm, user_id: user.id });

        if (error) throw error;
      }

      await fetchData();
      setAddressDialogOpen(false);
      resetAddressForm();
      toast({ title: "Амжилттай", description: "Хаяг хадгалагдлаа" });
    } catch (error) {
      toast({ title: "Алдаа", description: "Хадгалж чадсангүй", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteAddress = async (id: string) => {
    try {
      const { error } = await supabase.from("delivery_addresses").delete().eq("id", id);

      if (error) throw error;

      setAddresses((prev) => prev.filter((a) => a.id !== id));
      toast({ title: "Устгагдлаа" });
    } catch (error) {
      toast({ title: "Алдаа", description: "Устгаж чадсангүй", variant: "destructive" });
    }
  };

  const resetAddressForm = () => {
    setEditingAddress(null);
    setAddressForm({
      label: "",
      address_line: "",
      city: "Улаанбаатар",
      district: "",
      phone: "",
    });
  };

  const openEditAddress = (address: DeliveryAddress) => {
    setEditingAddress(address);
    setAddressForm({
      label: address.label,
      address_line: address.address_line,
      city: address.city,
      district: address.district || "",
      phone: address.phone || "",
    });
    setAddressDialogOpen(true);
  };

  const handleLogout = async () => {
    await signOut();
    navigate("/");
  };

  if (authLoading || isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b bg-card px-4 py-3">
        <div className="mx-auto flex max-w-md items-center justify-between">
          <div className="flex items-center gap-2">
            <User className="h-5 w-5 text-primary" />
            <h1 className="text-lg font-semibold">Профайл</h1>
          </div>
          <Button variant="ghost" size="sm" onClick={handleLogout}>
            <LogOut className="mr-2 h-4 w-4" />
            Гарах
          </Button>
        </div>
      </header>

      <main className="flex-1 px-4 py-6">
        <div className="mx-auto max-w-md space-y-6">
          {/* Wallet & Referral Quick Cards */}
          <div className="grid grid-cols-2 gap-3">
            <Card
              className="cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => navigate("/wallet")}
            >
              <CardContent className="pt-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-full bg-primary/10">
                    <Wallet className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Хэтэвч</p>
                    <p className="font-bold text-primary">{formatPrice(balance)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card
              className="cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => navigate("/referral")}
            >
              <CardContent className="pt-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-full bg-purple-500/10">
                    <Users className="h-5 w-5 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Урилга</p>
                    <p className="font-bold text-purple-600">{totalReferrals} найз</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
          {/* Profile Info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Хувийн мэдээлэл</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Утасны дугаар</Label>
                <Input value={profile?.phone || ""} disabled />
              </div>
              <div className="space-y-2">
                <Label>Нэр</Label>
                {isEditingProfile ? (
                  <div className="flex gap-2">
                    <Input
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Нэрээ оруулна уу"
                    />
                    <Button onClick={handleUpdateProfile} disabled={isSaving}>
                      Хадгалах
                    </Button>
                    <Button variant="outline" onClick={() => setIsEditingProfile(false)}>
                      Цуцлах
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <Input value={fullName || "Оруулаагүй"} disabled />
                    <Button variant="outline" size="icon" onClick={() => setIsEditingProfile(true)}>
                      <Edit2 className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>

              <Separator className="my-4" />

              {/* Branch Selection */}
              {profile && <BranchSelector profile={profile} onBranchChange={refreshProfile} />}
            </CardContent>
          </Card>

          {/* Delivery Addresses */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base">Хүргэлтийн хаяг</CardTitle>
                <CardDescription>Олон хаяг нэмж болно</CardDescription>
              </div>
              <Dialog open={addressDialogOpen} onOpenChange={setAddressDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" onClick={resetAddressForm}>
                    <Plus className="mr-2 h-4 w-4" />
                    Нэмэх
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{editingAddress ? "Хаяг засах" : "Шинэ хаяг нэмэх"}</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Нэр (жнь: Гэр, Ажил)</Label>
                      <Input
                        value={addressForm.label}
                        onChange={(e) => setAddressForm({ ...addressForm, label: e.target.value })}
                        placeholder="Гэр"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Хаяг</Label>
                      <Input
                        value={addressForm.address_line}
                        onChange={(e) => setAddressForm({ ...addressForm, address_line: e.target.value })}
                        placeholder="Дүүрэг, хороо, байр, тоот"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-2">
                        <Label>Хот</Label>
                        <Input
                          value={addressForm.city}
                          onChange={(e) => setAddressForm({ ...addressForm, city: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Дүүрэг</Label>
                        <Input
                          value={addressForm.district}
                          onChange={(e) => setAddressForm({ ...addressForm, district: e.target.value })}
                          placeholder="Баянзүрх"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Холбогдох утас</Label>
                      <Input
                        value={addressForm.phone}
                        onChange={(e) => setAddressForm({ ...addressForm, phone: e.target.value })}
                        placeholder="99112233"
                      />
                    </div>
                    <Button
                      className="w-full"
                      onClick={handleSaveAddress}
                      disabled={!addressForm.label || !addressForm.address_line || isSaving}
                    >
                      {isSaving ? "Хадгалж байна..." : "Хадгалах"}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              {addresses.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground py-4">Хаяг оруулаагүй байна</p>
              ) : (
                <div className="space-y-3">
                  {addresses.map((address) => (
                    <div key={address.id} className="flex items-start justify-between rounded-lg border p-3">
                      <div className="flex items-start gap-2">
                        <MapPin className="mt-0.5 h-4 w-4 text-muted-foreground shrink-0" />
                        <div>
                          <p className="font-medium text-sm">{address.label}</p>
                          <p className="text-xs text-muted-foreground">{address.address_line}</p>
                          {address.phone && <p className="text-xs text-muted-foreground">{address.phone}</p>}
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => openEditAddress(address)}
                        >
                          <Edit2 className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive"
                          onClick={() => handleDeleteAddress(address.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Cargo History */}
          <Card>
            <CardHeader className="cursor-pointer" onClick={() => setShowHistory(!showHistory)}>
              <CardTitle className="flex items-center gap-2 text-base">
                <History className="h-4 w-4" />
                Ачааны түүх ({cargoHistory.length})
              </CardTitle>
              <CardDescription>Хүлээлгэж өгсөн ачаанууд</CardDescription>
            </CardHeader>
            {showHistory && (
              <CardContent>
                {cargoHistory.length === 0 ? (
                  <p className="text-center text-sm text-muted-foreground py-4">Түүх байхгүй</p>
                ) : (
                  <div className="space-y-3">
                    {cargoHistory.map((cargo) => (
                      <CargoCard key={cargo.id} cargo={cargo} showPrice />
                    ))}
                  </div>
                )}
              </CardContent>
            )}
          </Card>
        </div>
      </main>
    </div>
  );
}
