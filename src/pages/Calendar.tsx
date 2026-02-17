import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  Clock,
  Download,
  Edit3,
  ExternalLink,
  GripVertical,
  RotateCcw,
  Trash2,
  Loader2,
  Filter,
} from "lucide-react";
import {
  format,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  addDays,
  addWeeks,
  addMonths,
  subWeeks,
  subMonths,
  isSameDay,
  isToday,
  eachDayOfInterval,
  setHours,
  setMinutes,
} from "date-fns";
import { ptBR } from "date-fns/locale";

interface CalendarContent {
  id: string;
  title: string;
  content_type: string;
  status: string;
  scheduled_at: string | null;
  created_at: string;
  brand_id: string | null;
  template_set_id: string | null;
  slides: any[];
  caption: string | null;
  brand_snapshot: any;
}

type ViewMode = "week" | "month";

const HOURS = Array.from({ length: 14 }, (_, i) => i + 7); // 7h-20h

const Calendar = () => {
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState<ViewMode>("week");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [contents, setContents] = useState<CalendarContent[]>([]);
  const [backlog, setBacklog] = useState<CalendarContent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedContent, setSelectedContent] = useState<CalendarContent | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);

  // Filters
  const [filterBrand, setFilterBrand] = useState<string>("all");
  const [filterFormat, setFilterFormat] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [brands, setBrands] = useState<{ id: string; name: string }[]>([]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch brands for filter
      const { data: brandsData } = await supabase
        .from("brands")
        .select("id, name")
        .eq("owner_user_id", user.id);
      setBrands(brandsData || []);

      // Date range
      const rangeStart = viewMode === "week"
        ? startOfWeek(currentDate, { weekStartsOn: 1 })
        : startOfMonth(currentDate);
      const rangeEnd = viewMode === "week"
        ? endOfWeek(currentDate, { weekStartsOn: 1 })
        : endOfMonth(currentDate);

      // Scheduled contents
      let scheduledQuery = supabase
        .from("generated_contents")
        .select("id, title, content_type, status, scheduled_at, created_at, brand_id, template_set_id, slides, caption, brand_snapshot")
        .eq("user_id", user.id)
        .in("status", ["scheduled", "approved", "published"])
        .gte("scheduled_at", rangeStart.toISOString())
        .lte("scheduled_at", rangeEnd.toISOString())
        .order("scheduled_at", { ascending: true });

      if (filterBrand !== "all") scheduledQuery = scheduledQuery.eq("brand_id", filterBrand);
      if (filterFormat !== "all") scheduledQuery = scheduledQuery.eq("content_type", filterFormat);
      if (filterStatus !== "all") scheduledQuery = scheduledQuery.eq("status", filterStatus);

      const { data: scheduledData } = await scheduledQuery;
      setContents((scheduledData as unknown as CalendarContent[]) || []);

      // Backlog: approved without scheduled_at (NOT drafts)
      let backlogQuery = supabase
        .from("generated_contents")
        .select("id, title, content_type, status, scheduled_at, created_at, brand_id, template_set_id, slides, caption, brand_snapshot")
        .eq("user_id", user.id)
        .eq("status", "approved")
        .is("scheduled_at", null)
        .order("created_at", { ascending: false })
        .limit(20);

      if (filterBrand !== "all") backlogQuery = backlogQuery.eq("brand_id", filterBrand);
      if (filterFormat !== "all") backlogQuery = backlogQuery.eq("content_type", filterFormat);

      const { data: backlogData } = await backlogQuery;
      setBacklog((backlogData as unknown as CalendarContent[]) || []);
    } catch (error) {
      console.error("Error fetching calendar data:", error);
    } finally {
      setLoading(false);
    }
  }, [currentDate, viewMode, filterBrand, filterFormat, filterStatus]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const navigateDate = (direction: "prev" | "next") => {
    if (viewMode === "week") {
      setCurrentDate(prev => direction === "prev" ? subWeeks(prev, 1) : addWeeks(prev, 1));
    } else {
      setCurrentDate(prev => direction === "prev" ? subMonths(prev, 1) : addMonths(prev, 1));
    }
  };

  const goToToday = () => setCurrentDate(new Date());

  const handleDragStart = (e: React.DragEvent, contentId: string) => {
    e.dataTransfer.setData("text/plain", contentId);
    setDraggingId(contentId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.currentTarget.classList.add("bg-primary/10");
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.currentTarget.classList.remove("bg-primary/10");
  };

  const handleDrop = async (e: React.DragEvent, day: Date, hour?: number) => {
    e.preventDefault();
    e.currentTarget.classList.remove("bg-primary/10");
    const contentId = e.dataTransfer.getData("text/plain");
    if (!contentId) return;

    const dropDate = hour !== undefined
      ? setMinutes(setHours(new Date(day), hour), 0)
      : setMinutes(setHours(new Date(day), 9), 0);

    try {
      const { error } = await supabase
        .from("generated_contents")
        .update({ scheduled_at: dropDate.toISOString(), status: "scheduled" })
        .eq("id", contentId);

      if (error) throw error;
      toast.success("Conteúdo agendado!", {
        description: format(dropDate, "dd/MM 'às' HH:mm", { locale: ptBR }),
      });
      fetchData();
    } catch (error) {
      console.error("Error scheduling:", error);
      toast.error("Erro ao agendar conteúdo");
    }
    setDraggingId(null);
  };

  const handleRemoveSchedule = async (id: string) => {
    try {
      await supabase
        .from("generated_contents")
        .update({ scheduled_at: null, status: "approved" })
        .eq("id", id);
      toast.success("Agendamento removido");
      setSelectedContent(null);
      fetchData();
    } catch (error) {
      toast.error("Erro ao remover agendamento");
    }
  };

  const handleReopen = async (id: string) => {
    try {
      await supabase
        .from("generated_contents")
        .update({ scheduled_at: null, status: "draft" })
        .eq("id", id);
      toast.success("Conteúdo reaberto para edição");
      setSelectedContent(null);
      fetchData();
    } catch (error) {
      toast.error("Erro ao reabrir conteúdo");
    }
  };

  // Days for the current view
  const days = viewMode === "week"
    ? eachDayOfInterval({
        start: startOfWeek(currentDate, { weekStartsOn: 1 }),
        end: endOfWeek(currentDate, { weekStartsOn: 1 }),
      })
    : eachDayOfInterval({
        start: startOfMonth(currentDate),
        end: endOfMonth(currentDate),
      });

  const getContentsForDay = (day: Date) =>
    contents.filter(c => c.scheduled_at && isSameDay(new Date(c.scheduled_at), day));

  const getContentsForDayHour = (day: Date, hour: number) =>
    contents.filter(c => {
      if (!c.scheduled_at) return false;
      const d = new Date(c.scheduled_at);
      return isSameDay(d, day) && d.getHours() === hour;
    });

  const formatBadge = (type: string) => {
    switch (type) {
      case "carousel": return "Carrossel";
      case "story": return "Story";
      default: return "Post";
    }
  };

  const statusColor = (status: string) => {
    switch (status) {
      case "draft": return "bg-muted text-muted-foreground";
      case "approved": return "bg-success/15 text-success border-success/30";
      case "scheduled": return "bg-primary/15 text-primary border-primary/30";
      case "published": return "bg-accent/15 text-accent border-accent/30";
      default: return "bg-muted text-muted-foreground";
    }
  };

  const ContentCard = ({ item, isDraggable = true }: { item: CalendarContent; isDraggable?: boolean }) => {
    const firstSlideImage = item.slides?.[0]?.image_url || item.slides?.[0]?.previewImage || item.slides?.[0]?.imageUrl;
    return (
      <div
        draggable={isDraggable}
        onDragStart={(e) => handleDragStart(e, item.id)}
        onClick={() => setSelectedContent(item)}
        className={`group cursor-pointer rounded-lg border p-2 transition-all hover:shadow-md ${
          draggingId === item.id ? "opacity-50" : ""
        } bg-card border-border/50`}
      >
        <div className="flex items-start gap-2">
          {isDraggable && (
            <GripVertical className="w-4 h-4 text-muted-foreground/50 mt-0.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
          )}
          {firstSlideImage && (
            <img src={firstSlideImage} alt="" className="w-10 h-10 rounded object-cover flex-shrink-0" />
          )}
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-foreground truncate">{item.title}</p>
            <div className="flex items-center gap-1 mt-1">
              <Badge variant="outline" className="text-[10px] px-1 py-0">{formatBadge(item.content_type)}</Badge>
              {item.scheduled_at && (
                <span className="text-[10px] text-muted-foreground">
                  {format(new Date(item.scheduled_at), "HH:mm")}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <DashboardLayout>
      <div className="p-6 lg:p-8 space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-heading font-bold text-foreground flex items-center gap-2">
              <CalendarDays className="w-7 h-7 text-primary" />
              Calendário de Conteúdos
            </h1>
            <p className="text-muted-foreground text-sm">
              Organize e agende seus conteúdos visualmente
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={goToToday}>Hoje</Button>
            <Button variant="ghost" size="icon" onClick={() => navigateDate("prev")}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="text-sm font-medium min-w-[160px] text-center">
              {viewMode === "week"
                ? `${format(days[0], "dd MMM", { locale: ptBR })} — ${format(days[days.length - 1], "dd MMM yyyy", { locale: ptBR })}`
                : format(currentDate, "MMMM yyyy", { locale: ptBR })}
            </span>
            <Button variant="ghost" size="icon" onClick={() => navigateDate("next")}>
              <ChevronRight className="w-4 h-4" />
            </Button>
            <Select value={viewMode} onValueChange={(v) => setViewMode(v as ViewMode)}>
              <SelectTrigger className="w-[110px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="week">Semana</SelectItem>
                <SelectItem value="month">Mês</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <Select value={filterBrand} onValueChange={setFilterBrand}>
            <SelectTrigger className="w-[150px] h-8 text-xs">
              <SelectValue placeholder="Marca" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as marcas</SelectItem>
              {brands.map(b => (
                <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterFormat} onValueChange={setFilterFormat}>
            <SelectTrigger className="w-[130px] h-8 text-xs">
              <SelectValue placeholder="Formato" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="carousel">Carrossel</SelectItem>
              <SelectItem value="post">Post</SelectItem>
              <SelectItem value="story">Story</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[130px] h-8 text-xs">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="draft">Rascunho</SelectItem>
              <SelectItem value="approved">Aprovado</SelectItem>
              <SelectItem value="scheduled">Agendado</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">
          {/* Backlog */}
          <Card className="shadow-card border-border/50 h-fit lg:sticky lg:top-6">
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-sm font-heading flex items-center justify-between">
                Backlog
                <Badge variant="secondary" className="text-xs">{backlog.length}</Badge>
              </CardTitle>
              <p className="text-xs text-muted-foreground">Arraste para o calendário</p>
            </CardHeader>
            <CardContent className="p-3 space-y-2 max-h-[60vh] overflow-y-auto">
              {loading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                </div>
              ) : backlog.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">
                  Nenhum conteúdo pendente
                </p>
              ) : (
                backlog.map(item => <ContentCard key={item.id} item={item} />)
              )}
            </CardContent>
          </Card>

          {/* Calendar Grid */}
          <Card className="shadow-card border-border/50 overflow-hidden">
            <CardContent className="p-0">
              {loading ? (
                <div className="flex items-center justify-center py-20">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : viewMode === "week" ? (
                /* Week View */
                <div className="overflow-auto max-h-[70vh]">
                  <div className="grid grid-cols-[60px_repeat(7,1fr)] min-w-[700px]">
                    {/* Header */}
                    <div className="sticky top-0 z-10 bg-muted/80 backdrop-blur border-b border-border p-2" />
                    {days.map(day => (
                      <div
                        key={day.toISOString()}
                        className={`sticky top-0 z-10 bg-muted/80 backdrop-blur border-b border-l border-border p-2 text-center ${
                          isToday(day) ? "bg-primary/10" : ""
                        }`}
                      >
                        <p className="text-[10px] text-muted-foreground uppercase">
                          {format(day, "EEE", { locale: ptBR })}
                        </p>
                        <p className={`text-sm font-semibold ${isToday(day) ? "text-primary" : "text-foreground"}`}>
                          {format(day, "dd")}
                        </p>
                      </div>
                    ))}

                    {/* Time slots */}
                    {HOURS.map(hour => (
                      <>
                        <div key={`h-${hour}`} className="border-b border-border p-1 text-[10px] text-muted-foreground text-right pr-2 pt-1">
                          {String(hour).padStart(2, "0")}:00
                        </div>
                        {days.map(day => {
                          const dayContents = getContentsForDayHour(day, hour);
                          return (
                            <div
                              key={`${day.toISOString()}-${hour}`}
                              className="border-b border-l border-border min-h-[56px] p-1 transition-colors"
                              onDragOver={handleDragOver}
                              onDragLeave={handleDragLeave}
                              onDrop={(e) => handleDrop(e, day, hour)}
                            >
                              {dayContents.map(c => (
                                <ContentCard key={c.id} item={c} isDraggable />
                              ))}
                            </div>
                          );
                        })}
                      </>
                    ))}
                  </div>
                </div>
              ) : (
                /* Month View */
                <div className="grid grid-cols-7 min-w-[600px]">
                  {/* Header */}
                  {["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"].map(d => (
                    <div key={d} className="p-2 text-center text-xs font-medium text-muted-foreground border-b border-border bg-muted/50">
                      {d}
                    </div>
                  ))}
                  {/* Pad start */}
                  {(() => {
                    const monthStart = startOfMonth(currentDate);
                    const dayOfWeek = (monthStart.getDay() + 6) % 7; // Mon=0
                    const pads = [];
                    for (let i = 0; i < dayOfWeek; i++) {
                      pads.push(
                        <div key={`pad-${i}`} className="border-b border-r border-border min-h-[100px] p-1 bg-muted/20" />
                      );
                    }
                    return pads;
                  })()}
                  {days.map(day => {
                    const dayContents = getContentsForDay(day);
                    return (
                      <div
                        key={day.toISOString()}
                        className={`border-b border-r border-border min-h-[100px] p-1 transition-colors ${
                          isToday(day) ? "bg-primary/5" : ""
                        }`}
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={(e) => handleDrop(e, day)}
                      >
                        <p className={`text-xs font-medium mb-1 ${isToday(day) ? "text-primary" : "text-muted-foreground"}`}>
                          {format(day, "d")}
                        </p>
                        <div className="space-y-1">
                          {dayContents.slice(0, 3).map(c => (
                            <ContentCard key={c.id} item={c} isDraggable />
                          ))}
                          {dayContents.length > 3 && (
                            <p className="text-[10px] text-muted-foreground text-center">
                              +{dayContents.length - 3} mais
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Detail Sheet */}
      <Sheet open={!!selectedContent} onOpenChange={() => setSelectedContent(null)}>
        <SheetContent className="sm:max-w-md">
          {selectedContent && (
            <>
              <SheetHeader>
                <SheetTitle className="text-lg">{selectedContent.title}</SheetTitle>
              </SheetHeader>
              <div className="mt-4 space-y-4">
                {/* Thumbnail */}
                {selectedContent.slides?.[0]?.previewImage && (
                  <img
                    src={selectedContent.slides[0].previewImage}
                    alt="Preview"
                    className="w-full aspect-[4/5] object-cover rounded-lg"
                  />
                )}

                {/* Info */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Status</span>
                    <Badge className={statusColor(selectedContent.status)}>
                      {selectedContent.status === "draft" ? "Rascunho" :
                       selectedContent.status === "approved" ? "Aprovado" :
                       selectedContent.status === "scheduled" ? "Agendado" : "Publicado"}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Formato</span>
                    <span className="text-sm font-medium">{formatBadge(selectedContent.content_type)}</span>
                  </div>
                  {selectedContent.brand_snapshot?.name && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Marca</span>
                      <span className="text-sm font-medium">{selectedContent.brand_snapshot.name}</span>
                    </div>
                  )}
                  {selectedContent.scheduled_at && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Agendado para</span>
                      <span className="text-sm font-medium flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {format(new Date(selectedContent.scheduled_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Slides</span>
                    <span className="text-sm font-medium">{selectedContent.slides?.length || 0}</span>
                  </div>
                </div>

                {selectedContent.caption && (
                  <>
                    <Separator />
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Legenda</p>
                      <p className="text-sm text-foreground line-clamp-4">{selectedContent.caption}</p>
                    </div>
                  </>
                )}

                <Separator />

                {/* Actions */}
                <div className="space-y-2">
                  <Button
                    className="w-full gap-2"
                    onClick={() => navigate(`/content/${selectedContent.id}`)}
                  >
                    <ExternalLink className="w-4 h-4" />
                    Abrir Editor
                  </Button>
                  {(selectedContent.status === "approved" || selectedContent.status === "scheduled") && (
                    <Button
                      variant="outline"
                      className="w-full gap-2"
                      onClick={() => navigate(`/download/${selectedContent.id}`)}
                    >
                      <Download className="w-4 h-4" />
                      Baixar ZIP
                    </Button>
                  )}
                  {selectedContent.status === "scheduled" && (
                    <Button
                      variant="outline"
                      className="w-full gap-2"
                      onClick={() => handleRemoveSchedule(selectedContent.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                      Remover Agendamento
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    className="w-full gap-2 text-muted-foreground"
                    onClick={() => handleReopen(selectedContent.id)}
                  >
                    <RotateCcw className="w-4 h-4" />
                    Reabrir para Edição
                  </Button>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </DashboardLayout>
  );
};

export default Calendar;
