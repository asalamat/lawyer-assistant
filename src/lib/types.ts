export interface Matter {
  id: string;
  title: string;
  clientName: string;
  matterType: string;
  status: "open" | "closed";
  createdAt: string;
}

export interface Document {
  id: string;
  matterId: string;
  fileName: string;
  sizeBytes: number;
  uploadedAt: string;
  storagePath: string;
}
