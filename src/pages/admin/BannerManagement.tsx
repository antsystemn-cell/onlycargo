import { useState, useEffect, useRef } from 'react';
import { Image, Plus, Trash2, GripVertical, Eye, EyeOff, Save, Upload, Link as LinkIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { Banner } from '@/types/cargo';

export default function BannerManagement() {
  const { toast } = useToast();
  const [banners, setBanners] = useState<Banner[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingBanner, setEditingBanner] = useState<Banner | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form state
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formImageUrl, setFormImageUrl] = useState('');
  const [formLinkUrl, setFormLinkUrl] = useState('');
  const [formEnabled, setFormEnabled] = useState(true);
  const [uploadingImage, setUploadingImage] = useState(false);

  const fetchBanners = async () => {
    const { data, error } = await supabase
      .from('banners')
      .select('*')
      .order('sort_order', { ascending: true });

    if (error) {
      console.error('Error fetching banners:', error);
      return;
    }

    setBanners(data as Banner[]);
    setIsLoading(false);
  };

  useEffect(() => {
    fetchBanners();
  }, []);

  const resetForm = () => {
    setFormTitle('');
    setFormDescription('');
    setFormImageUrl('');
    setFormLinkUrl('');
    setFormEnabled(true);
    setEditingBanner(null);
  };

  const openEditDialog = (banner: Banner) => {
    setEditingBanner(banner);
    setFormTitle(banner.title);
    setFormDescription(banner.description || '');
    setFormImageUrl(banner.image_url || '');
    setFormLinkUrl(banner.link_url || '');
    setFormEnabled(banner.is_enabled);
    setIsDialogOpen(true);
  };

  const openCreateDialog = () => {
    resetForm();
    setIsDialogOpen(true);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingImage(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `banner-${Date.now()}.${fileExt}`;

      const { data, error } = await supabase.storage
        .from('site-assets')
        .upload(fileName, file, { upsert: true });

      if (error) throw error;

      const { data: urlData } = supabase.storage
        .from('site-assets')
        .getPublicUrl(data.path);

      setFormImageUrl(urlData.publicUrl);
      toast({ title: 'Зураг амжилттай хуулагдлаа' });
    } catch (error) {
      console.error('Upload error:', error);
      toast({ title: 'Зураг хуулахад алдаа гарлаа', variant: 'destructive' });
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSave = async () => {
    if (!formTitle.trim()) {
      toast({ title: 'Гарчиг оруулна уу', variant: 'destructive' });
      return;
    }

    setIsSaving(true);
    try {
      if (editingBanner) {
        // Update existing
        const { error } = await supabase
          .from('banners')
          .update({
            title: formTitle,
            description: formDescription || null,
            image_url: formImageUrl || null,
            link_url: formLinkUrl || null,
            is_enabled: formEnabled,
          })
          .eq('id', editingBanner.id);

        if (error) throw error;
        toast({ title: 'Баннер шинэчлэгдлээ' });
      } else {
        // Create new
        const maxOrder = Math.max(...banners.map(b => b.sort_order), -1);
        const { error } = await supabase
          .from('banners')
          .insert({
            title: formTitle,
            description: formDescription || null,
            image_url: formImageUrl || null,
            link_url: formLinkUrl || null,
            is_enabled: formEnabled,
            sort_order: maxOrder + 1,
          });

        if (error) throw error;
        toast({ title: 'Баннер нэмэгдлээ' });
      }

      setIsDialogOpen(false);
      resetForm();
      fetchBanners();
    } catch (error) {
      console.error('Save error:', error);
      toast({ title: 'Хадгалахад алдаа гарлаа', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from('banners')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast({ title: 'Баннер устгагдлаа' });
      fetchBanners();
    } catch (error) {
      console.error('Delete error:', error);
      toast({ title: 'Устгахад алдаа гарлаа', variant: 'destructive' });
    }
  };

  const handleToggleEnabled = async (banner: Banner) => {
    try {
      const { error } = await supabase
        .from('banners')
        .update({ is_enabled: !banner.is_enabled })
        .eq('id', banner.id);

      if (error) throw error;
      fetchBanners();
    } catch (error) {
      console.error('Toggle error:', error);
      toast({ title: 'Өөрчлөхөд алдаа гарлаа', variant: 'destructive' });
    }
  };

  const moveBanner = async (index: number, direction: 'up' | 'down') => {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= banners.length) return;

    const newBanners = [...banners];
    [newBanners[index], newBanners[newIndex]] = [newBanners[newIndex], newBanners[index]];

    // Update sort orders
    try {
      for (let i = 0; i < newBanners.length; i++) {
        await supabase
          .from('banners')
          .update({ sort_order: i })
          .eq('id', newBanners[i].id);
      }
      fetchBanners();
    } catch (error) {
      console.error('Reorder error:', error);
      toast({ title: 'Дараалал өөрчлөхөд алдаа гарлаа', variant: 'destructive' });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Баннер удирдлага</h1>
          <p className="text-muted-foreground">Нүүр хуудасны баннерүүдийг удирдах</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreateDialog}>
              <Plus className="mr-2 h-4 w-4" />
              Баннер нэмэх
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{editingBanner ? 'Баннер засах' : 'Шинэ баннер'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Гарчиг *</Label>
                <Input
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="Баннерын гарчиг"
                />
              </div>

              <div className="space-y-2">
                <Label>Тайлбар</Label>
                <Textarea
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Баннерын тайлбар"
                  rows={2}
                />
              </div>

              <div className="space-y-2">
                <Label>Зураг</Label>
                <div className="flex gap-2">
                  <Input
                    value={formImageUrl}
                    onChange={(e) => setFormImageUrl(e.target.value)}
                    placeholder="Зургийн URL"
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingImage}
                  >
                    {uploadingImage ? (
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    ) : (
                      <Upload className="h-4 w-4" />
                    )}
                  </Button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleImageUpload}
                  />
                </div>
                {formImageUrl && (
                  <div className="relative h-24 rounded-lg overflow-hidden border">
                    <img
                      src={formImageUrl}
                      alt="Preview"
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label>Холбоос (URL)</Label>
                <div className="flex items-center gap-2">
                  <LinkIcon className="h-4 w-4 text-muted-foreground" />
                  <Input
                    value={formLinkUrl}
                    onChange={(e) => setFormLinkUrl(e.target.value)}
                    placeholder="https://..."
                    className="flex-1"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between">
                <Label>Идэвхтэй</Label>
                <Switch checked={formEnabled} onCheckedChange={setFormEnabled} />
              </div>

              <Button onClick={handleSave} className="w-full" disabled={isSaving}>
                {isSaving ? (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Хадгалах
                  </>
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {banners.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Image className="mx-auto h-12 w-12 text-muted-foreground opacity-50 mb-4" />
            <p className="text-muted-foreground">Баннер байхгүй байна</p>
            <Button className="mt-4" onClick={openCreateDialog}>
              <Plus className="mr-2 h-4 w-4" />
              Эхний баннер нэмэх
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {banners.map((banner, index) => (
            <Card key={banner.id} className={!banner.is_enabled ? 'opacity-50' : ''}>
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  {/* Drag handle & reorder buttons */}
                  <div className="flex flex-col gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => moveBanner(index, 'up')}
                      disabled={index === 0}
                    >
                      <span className="text-xs">▲</span>
                    </Button>
                    <GripVertical className="h-4 w-4 text-muted-foreground mx-auto" />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => moveBanner(index, 'down')}
                      disabled={index === banners.length - 1}
                    >
                      <span className="text-xs">▼</span>
                    </Button>
                  </div>

                  {/* Image preview */}
                  <div className="w-24 h-16 rounded-lg overflow-hidden border bg-muted flex-shrink-0">
                    {banner.image_url ? (
                      <img
                        src={banner.image_url}
                        alt={banner.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Image className="h-6 w-6 text-muted-foreground" />
                      </div>
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium truncate">{banner.title}</h3>
                    {banner.description && (
                      <p className="text-sm text-muted-foreground truncate">{banner.description}</p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleToggleEnabled(banner)}
                      title={banner.is_enabled ? 'Идэвхгүй болгох' : 'Идэвхтэй болгох'}
                    >
                      {banner.is_enabled ? (
                        <Eye className="h-4 w-4" />
                      ) : (
                        <EyeOff className="h-4 w-4" />
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openEditDialog(banner)}
                    >
                      Засах
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Баннер устгах уу?</AlertDialogTitle>
                          <AlertDialogDescription>
                            "{banner.title}" баннерыг устгахдаа итгэлтэй байна уу?
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Болих</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDelete(banner.id)}>
                            Устгах
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
