import { useState, useMemo, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Eye, Plus, Search, ArrowUpDown, ChevronUp, ChevronDown, RefreshCw } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { AddVehicleDialog } from "@/components/AddVehicleDialog";
import { VehicleStatusBadge } from "@/components/VehicleStatusBadge";
import { AcquisitionBadge } from "@/components/AcquisitionBadge";
import { MOTTaxStatusChip } from "@/components/MOTTaxStatusChip";
import { WarrantyStatusChip } from "@/components/WarrantyStatusChip";
import { NetPLChip } from "@/components/NetPLChip";
import { VehiclePhotoThumbnail } from "@/components/VehiclePhotoThumbnail";
import { computeVehicleStatus, VehicleStatus, VehiclePLData, formatCurrency } from "@/lib/vehicleUtils";
import { useActiveRentals } from "@/hooks/useActiveRentals";

interface Vehicle {
  id: string;
  reg: string;
  make: string;
  model: string;
  colour: string;
  acquisition_type: string;
  purchase_price?: number;
  mot_due_date?: string;
  tax_due_date?: string;
  warranty_start_date?: string;
  warranty_end_date?: string;
  is_disposed: boolean;
  disposal_date?: string;
  status: string;
  photo_url?: string;
}

type SortField = 'reg' | 'make_model' | 'acquisition_type' | 'status' | 'mot_due_date' | 'tax_due_date' | 'warranty_end_date' | 'net_profit';
type SortDirection = 'asc' | 'desc';
type PerformanceFilter = 'all' | 'profitable' | 'loss';

interface FiltersState {
  search: string;
  status: string;
  make: string;
  performance: PerformanceFilter;
}

export default function VehiclesListEnhanced() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();

  // State from URL params
  const [filters, setFilters] = useState<FiltersState>({
    search: searchParams.get('search') || '',
    status: searchParams.get('status') || 'all',
    make: searchParams.get('make') || 'all',
    performance: (searchParams.get('performance') as PerformanceFilter) || 'all',
  });

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Sync pagination state with URL params
  useEffect(() => {
    const urlCurrentPage = parseInt(searchParams.get('page') || '1');
    const urlPageSize = parseInt(searchParams.get('limit') || '25');
    
    setCurrentPage(urlCurrentPage);
    setPageSize(urlPageSize);
  }, [searchParams]);

  // Read sort params directly from URL
  const sortField = (searchParams.get('sort') as SortField) || 'reg';
  const sortDirection = (searchParams.get('dir') as SortDirection) || 'asc';

  // Update URL params when filters change
  const updateFilters = (newFilters: Partial<FiltersState>) => {
    const updatedFilters = { ...filters, ...newFilters };
    setFilters(updatedFilters);
    
    const params = new URLSearchParams();
    Object.entries(updatedFilters).forEach(([key, value]) => {
      if (value && value !== 'all') params.set(key, value);
    });
    if (sortField !== 'reg') params.set('sort', sortField);
    if (sortDirection !== 'asc') params.set('dir', sortDirection);
    if (currentPage !== 1) params.set('page', currentPage.toString());
    if (pageSize !== 25) params.set('limit', pageSize.toString());
    
    setSearchParams(params);
  };

  // Data fetching
  const { data: vehicles = [], isLoading: vehiclesLoading } = useQuery({
    queryKey: ["vehicles-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vehicles")
        .select("*")
        .order("reg");
      
      if (error) throw error;
      return data as Vehicle[];
    },
  });

  const { data: plData = [], isLoading: plLoading } = useQuery({
    queryKey: ["vehicles-pl"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("view_pl_by_vehicle")
        .select("*");
      
      if (error) throw error;
      return data as VehiclePLData[];
    },
  });

  const { data: activeRentals = [] } = useActiveRentals();

  const isLoading = vehiclesLoading || plLoading;

  // Combine vehicle data with P&L and status
  const enhancedVehicles = useMemo(() => {
    return vehicles.map(vehicle => {
      const plEntry = plData.find(pl => pl.vehicle_id === vehicle.id);
      const computedStatus = computeVehicleStatus(vehicle, activeRentals);
      
      return {
        ...vehicle,
        computed_status: computedStatus,
        pl_data: plEntry || {
          total_revenue: 0,
          total_costs: 0,
          net_profit: 0,
          revenue_rental: 0,
          revenue_fees: 0,
          cost_acquisition: 0,
          cost_service: 0,
          cost_fines: 0,
        },
      };
    });
  }, [vehicles, plData, activeRentals]);

  // Filter and sort vehicles
  const filteredVehicles = useMemo(() => {
    let filtered = enhancedVehicles;

    // Search filter
    if (filters.search) {
      const search = filters.search.toLowerCase();
      filtered = filtered.filter(vehicle => 
        vehicle.reg.toLowerCase().includes(search) ||
        vehicle.make?.toLowerCase().includes(search) ||
        vehicle.model?.toLowerCase().includes(search)
      );
    }

    // Status filter
    if (filters.status !== 'all') {
      filtered = filtered.filter(vehicle => 
        vehicle.computed_status.toLowerCase() === filters.status.toLowerCase()
      );
    }

    // Make filter
    if (filters.make !== 'all') {
      filtered = filtered.filter(vehicle => vehicle.make === filters.make);
    }

    // Performance filter
    if (filters.performance !== 'all') {
      filtered = filtered.filter(vehicle => {
        const net = vehicle.pl_data.net_profit;
        return filters.performance === 'profitable' ? net > 0 : net < 0;
      });
    }

    // Sort
    filtered.sort((a, b) => {
      let aVal: any = '';
      let bVal: any = '';

      switch (sortField) {
        case 'reg':
          aVal = a.reg;
          bVal = b.reg;
          break;
        case 'make_model':
          aVal = `${a.make} ${a.model}`;
          bVal = `${b.make} ${b.model}`;
          break;
        case 'acquisition_type':
          aVal = a.acquisition_type;
          bVal = b.acquisition_type;
          break;
        case 'status':
          aVal = a.computed_status;
          bVal = b.computed_status;
          break;
        case 'mot_due_date':
          aVal = a.mot_due_date || '9999-12-31';
          bVal = b.mot_due_date || '9999-12-31';
          break;
        case 'tax_due_date':
          aVal = a.tax_due_date || '9999-12-31';
          bVal = b.tax_due_date || '9999-12-31';
          break;
        case 'net_profit':
          aVal = a.pl_data.net_profit;
          bVal = b.pl_data.net_profit;
          break;
        default:
          aVal = a.reg;
          bVal = b.reg;
      }

      if (typeof aVal === 'string') {
        return sortDirection === 'asc' 
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      } else {
        return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
      }
    });

    console.log('Filtered and sorted vehicles:', filtered.map(v => ({ reg: v.reg, status: v.computed_status, sortField, sortDirection })));
    return filtered;
  }, [enhancedVehicles, filters, sortField, sortDirection, searchParams]);

  // Pagination
  const totalPages = Math.ceil(filteredVehicles.length / pageSize);
  const paginatedVehicles = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    const paginated = filteredVehicles.slice(startIndex, startIndex + pageSize);
    console.log(`Paginated vehicles (page ${currentPage}):`, paginated.map(v => ({ reg: v.reg, status: v.computed_status })));
    return paginated;
  }, [filteredVehicles, currentPage, pageSize, searchParams]);

  // Get unique makes for filter
  const uniqueMakes = useMemo(() => {
    const makes = [...new Set(vehicles.map(v => v.make).filter(Boolean))];
    return makes.sort();
  }, [vehicles]);

  const handleSort = (field: SortField) => {
    const newDirection = sortField === field && sortDirection === 'asc' ? 'desc' : 'asc';
    
    const params = new URLSearchParams(searchParams);
    params.set('sort', field);
    params.set('dir', newDirection);
    
    // Reset to page 1 when sorting
    params.delete('page');
    setCurrentPage(1);
    
    setSearchParams(params);
    
    // Debug logging
    console.log(`Sorting by ${field} in ${newDirection} direction`);
  };

  const handleRowClick = (vehicleId: string) => {
    navigate(`/vehicles/${vehicleId}`);
  };

  const clearFilters = () => {
    setFilters({
      search: '',
      status: 'all',
      make: 'all',
      performance: 'all',
    });
    setCurrentPage(1);
    setSearchParams(new URLSearchParams());
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) return <ArrowUpDown className="h-4 w-4" />;
    return sortDirection === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />;
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-start">
          <div>
            <Skeleton className="h-8 w-48 mb-2" />
            <Skeleton className="h-4 w-96" />
          </div>
          <Skeleton className="h-10 w-32" />
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-10" />
          ))}
        </div>
        
        <Card>
          <CardContent className="p-0">
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold">Fleet Management</h1>
          <p className="text-muted-foreground">
            Manage your vehicle fleet, track P&L performance, and monitor compliance
          </p>
        </div>
        <div data-add-vehicle-trigger>
          <AddVehicleDialog />
        </div>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="relative">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search vehicles..."
            value={filters.search}
            onChange={(e) => updateFilters({ search: e.target.value })}
            className="pl-9"
          />
        </div>
        
        <Select value={filters.status} onValueChange={(value) => updateFilters({ status: value })}>
          <SelectTrigger>
            <SelectValue placeholder="All Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="available">Available</SelectItem>
            <SelectItem value="rented">Rented</SelectItem>
            <SelectItem value="disposed">Disposed</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filters.make} onValueChange={(value) => updateFilters({ make: value })}>
          <SelectTrigger>
            <SelectValue placeholder="All Makes" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Makes</SelectItem>
            {uniqueMakes.map(make => (
              <SelectItem key={make} value={make}>{make}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filters.performance} onValueChange={(value) => updateFilters({ performance: value as PerformanceFilter })}>
          <SelectTrigger>
            <SelectValue placeholder="All Performance" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Performance</SelectItem>
            <SelectItem value="profitable">Profitable</SelectItem>
            <SelectItem value="loss">Loss Making</SelectItem>
          </SelectContent>
        </Select>

        <Button 
          variant="outline" 
          onClick={clearFilters}
          className="flex items-center gap-2"
        >
          <RefreshCw className="h-4 w-4" />
          Clear
        </Button>
      </div>

      {/* Results Info */}
      <div className="text-sm text-muted-foreground">
        Showing {paginatedVehicles.length} of {filteredVehicles.length} vehicles
      </div>

      {/* Table */}
      {filteredVehicles.length === 0 ? (
        <EmptyState
          icon={Plus}
          title="No vehicles found"
          description="No vehicles match your current filters. Try adjusting your search criteria."
          actionLabel="Add Vehicle"
          onAction={() => {
            // Open add vehicle dialog programmatically
            const addButton = document.querySelector('[data-add-vehicle-trigger]') as HTMLButtonElement;
            addButton?.click();
          }}
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table key={`${sortField}-${sortDirection}`}>
               <TableHeader>
                 <TableRow>
                   <TableHead>Photo</TableHead>
                   <TableHead className="cursor-pointer" onClick={() => handleSort('reg')}>
                     <div className="flex items-center gap-2">
                       Registration
                       {getSortIcon('reg')}
                     </div>
                   </TableHead>
                  <TableHead className="cursor-pointer" onClick={() => handleSort('make_model')}>
                    <div className="flex items-center gap-2">
                      Make/Model
                      {getSortIcon('make_model')}
                    </div>
                  </TableHead>
                  <TableHead>Colour</TableHead>
                  <TableHead className="cursor-pointer" onClick={() => handleSort('acquisition_type')}>
                    <div className="flex items-center gap-2">
                      Acquisition
                      {getSortIcon('acquisition_type')}
                    </div>
                  </TableHead>
                  <TableHead className="cursor-pointer" onClick={() => handleSort('status')}>
                    <div className="flex items-center gap-2">
                      Status
                      {getSortIcon('status')}
                    </div>
                  </TableHead>
                  <TableHead className="cursor-pointer" onClick={() => handleSort('mot_due_date')}>
                    <div className="flex items-center gap-2">
                      MOT Due
                      {getSortIcon('mot_due_date')}
                    </div>
                  </TableHead>
                  <TableHead className="cursor-pointer" onClick={() => handleSort('tax_due_date')}>
                    <div className="flex items-center gap-2">
                      TAX Due
                      {getSortIcon('tax_due_date')}
                     </div>
                   </TableHead>
                   <TableHead className="cursor-pointer" onClick={() => handleSort('warranty_end_date')}>
                     <div className="flex items-center gap-2">
                       Warranty
                       {getSortIcon('warranty_end_date')}
                     </div>
                   </TableHead>
                   <TableHead className="cursor-pointer text-right" onClick={() => handleSort('net_profit')}>
                    <div className="flex items-center justify-end gap-2">
                      Net P&L
                      {getSortIcon('net_profit')}
                    </div>
                  </TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedVehicles.map((vehicle, index) => {
                  console.log(`Rendering vehicle ${index}:`, vehicle.reg, vehicle.computed_status);
                  return (
                    <TableRow 
                      key={`${vehicle.id}-${sortField}-${sortDirection}`}
                      className="cursor-pointer hover:bg-muted/50"
                       onClick={() => handleRowClick(vehicle.id)}
                     >
                     <TableCell>
                       <VehiclePhotoThumbnail
                         photoUrl={vehicle.photo_url}
                         vehicleReg={vehicle.reg}
                         size="sm"
                         onClick={() => navigate(`/vehicles/${vehicle.id}`)}
                       />
                     </TableCell>
                     <TableCell>
                      <Link 
                        to={`/vehicles/${vehicle.id}`}
                        className="font-bold text-primary hover:underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {vehicle.reg}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="font-medium">{vehicle.make}</div>
                        <div className="text-sm text-muted-foreground truncate">
                          {vehicle.model}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{vehicle.colour}</TableCell>
                    <TableCell>
                      <AcquisitionBadge acquisitionType={vehicle.acquisition_type} />
                    </TableCell>
                    <TableCell>
                      <VehicleStatusBadge status={vehicle.computed_status} />
                    </TableCell>
                    <TableCell>
                      <MOTTaxStatusChip 
                        dueDate={vehicle.mot_due_date} 
                        type="MOT" 
                        compact 
                      />
                    </TableCell>
                    <TableCell>
                      <MOTTaxStatusChip 
                        dueDate={vehicle.tax_due_date} 
                        type="TAX" 
                        compact 
                      />
                     </TableCell>
                     <TableCell>
                       <WarrantyStatusChip 
                         dueDate={vehicle.warranty_end_date} 
                         compact 
                       />
                     </TableCell>
                    <TableCell>
                      <WarrantyStatusChip 
                        dueDate={vehicle.warranty_end_date} 
                        compact 
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <NetPLChip
                        revenue={vehicle.pl_data.total_revenue}
                        costs={vehicle.pl_data.total_costs}
                        net={vehicle.pl_data.net_profit}
                        compact
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/vehicles/${vehicle.id}`);
                        }}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                   </TableRow>
                   );
                 })}
               </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Rows per page:</span>
            <Select value={pageSize.toString()} onValueChange={(value) => {
              setPageSize(parseInt(value));
              setCurrentPage(1);
              const params = new URLSearchParams(searchParams);
              params.set('limit', value);
              params.delete('page');
              setSearchParams(params);
            }}>
              <SelectTrigger className="w-20">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="25">25</SelectItem>
                <SelectItem value="50">50</SelectItem>
                <SelectItem value="100">100</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage === 1}
              onClick={() => {
                setCurrentPage(currentPage - 1);
                const params = new URLSearchParams(searchParams);
                params.set('page', (currentPage - 1).toString());
                setSearchParams(params);
              }}
            >
              Previous
            </Button>
            
            <span className="text-sm text-muted-foreground">
              Page {currentPage} of {totalPages}
            </span>
            
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage === totalPages}
              onClick={() => {
                setCurrentPage(currentPage + 1);
                const params = new URLSearchParams(searchParams);
                params.set('page', (currentPage + 1).toString());
                setSearchParams(params);
              }}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}