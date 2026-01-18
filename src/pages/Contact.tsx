import { useState } from "react";
import { motion } from "framer-motion";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Mail, MessageSquare, Send, Loader2, CheckCircle } from "lucide-react";
import MainLayout from "@/components/layout/MainLayout";
import Head from "@/components/common/Head";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CONTACT_CONFIG } from "@/config/contact";
const contactSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  email: z.string().email("Please enter a valid email"),
  subject: z.string().optional(),
  message: z.string().min(10, "Message must be at least 10 characters").max(5000),
  type: z.enum(["general", "support", "feedback", "bug_report", "feature_request"]).default("general"),
});

type ContactFormData = z.infer<typeof contactSchema>;

const Contact = () => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    reset,
    formState: { errors },
  } = useForm<ContactFormData>({
    resolver: zodResolver(contactSchema),
    defaultValues: {
      type: "general",
    },
  });

  const onSubmit = async (data: ContactFormData) => {
    setIsSubmitting(true);
    try {
      const { data: result, error } = await supabase.functions.invoke("send-contact-email", {
        body: data,
      });

      if (error) throw error;

      if (result?.success) {
        setIsSuccess(true);
        reset();
        toast.success("Message sent successfully!");
      } else {
        throw new Error(result?.error || "Failed to send message");
      }
    } catch (error: any) {
      console.error("Contact form error:", error);
      toast.error(error.message || "Failed to send message. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const contactTypes = [
    { value: "general", label: "General Inquiry" },
    { value: "support", label: "Support Request" },
    { value: "feedback", label: "Feedback" },
    { value: "bug_report", label: "Report a Bug" },
    { value: "feature_request", label: "Feature Request" },
  ];

  return (
    <MainLayout>
      <Head title="Contact Us | Voyance" description="Get in touch with the Voyance team. We're here to help with your travel planning questions and feedback." />

      <div className="min-h-screen bg-background">
        {/* Hero Section */}
        <section className="relative pt-32 pb-16 px-4 bg-gradient-to-b from-muted/50 to-background">
          <div className="container max-w-4xl mx-auto text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <MessageSquare className="w-16 h-16 mx-auto mb-6 text-primary" />
              <h1 className="text-4xl md:text-5xl font-bold mb-4">Get in Touch</h1>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                Have a question, feedback, or need help with your trip? We'd love to hear from you.
              </p>
            </motion.div>
          </div>
        </section>

        {/* Contact Form Section */}
        <section className="py-16 px-4">
          <div className="container max-w-2xl mx-auto">
            {isSuccess ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center py-12"
              >
                <CheckCircle className="w-20 h-20 mx-auto mb-6 text-green-500" />
                <h2 className="text-2xl font-bold mb-4">Message Sent!</h2>
                <p className="text-muted-foreground mb-8">
                  Thank you for reaching out. We'll get back to you within 24-48 hours.
                </p>
                <Button onClick={() => setIsSuccess(false)}>
                  Send Another Message
                </Button>
              </motion.div>
            ) : (
              <motion.form
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.2 }}
                onSubmit={handleSubmit(onSubmit)}
                className="space-y-6 bg-card p-8 rounded-xl border shadow-sm"
              >
                <div className="grid gap-6 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="name">Name *</Label>
                    <Input
                      id="name"
                      placeholder="Your name"
                      {...register("name")}
                      className={errors.name ? "border-destructive" : ""}
                    />
                    {errors.name && (
                      <p className="text-sm text-destructive">{errors.name.message}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email">Email *</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="your@email.com"
                      {...register("email")}
                      className={errors.email ? "border-destructive" : ""}
                    />
                    {errors.email && (
                      <p className="text-sm text-destructive">{errors.email.message}</p>
                    )}
                  </div>
                </div>

                <div className="grid gap-6 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="type">Type</Label>
                    <Select
                      defaultValue="general"
                      onValueChange={(value) => setValue("type", value as ContactFormData["type"])}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        {contactTypes.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="subject">Subject (optional)</Label>
                    <Input
                      id="subject"
                      placeholder="Brief subject line"
                      {...register("subject")}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="message">Message *</Label>
                  <Textarea
                    id="message"
                    placeholder="Tell us how we can help..."
                    rows={6}
                    {...register("message")}
                    className={errors.message ? "border-destructive" : ""}
                  />
                  {errors.message && (
                    <p className="text-sm text-destructive">{errors.message.message}</p>
                  )}
                </div>

                <Button
                  type="submit"
                  size="lg"
                  className="w-full"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4 mr-2" />
                      Send Message
                    </>
                  )}
                </Button>
              </motion.form>
            )}

            {/* Additional Contact Info */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="mt-12 text-center"
            >
              <p className="text-muted-foreground mb-4">
                Prefer email? Reach us directly at:
              </p>
              <a
                href={`mailto:${CONTACT_CONFIG.SUPPORT_EMAIL}`}
                className="inline-flex items-center gap-2 text-primary hover:underline"
              >
                <Mail className="w-4 h-4" />
                {CONTACT_CONFIG.SUPPORT_EMAIL}
              </a>
            </motion.div>
          </div>
        </section>
      </div>
    </MainLayout>
  );
};

export default Contact;
