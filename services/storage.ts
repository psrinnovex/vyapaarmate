export type UploadInput = {
  fileName: string;
  contentType: string;
  folder: "logos" | "menu-items" | "kyc";
};

export async function createUploadUrl(input: UploadInput) {
  if (!process.env.S3_BUCKET) {
    return {
      status: "placeholder",
      uploadUrl: `/api/uploads/placeholder/${input.folder}/${input.fileName}`,
      publicUrl: `/uploads/${input.folder}/${input.fileName}`
    };
  }

  // Generate an S3/Supabase signed URL here in production.
  return {
    status: "ready",
    uploadUrl: "",
    publicUrl: ""
  };
}
