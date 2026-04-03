import { useState } from "react";
import { motion } from "framer-motion";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Mail, Send, Loader2, CheckCircle, ArrowRight } from "lucide-react";
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
  type: z.enum(["general", "support", "feedback", "partnership"]).default("general"),
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
    { value: "support", label: "Trip Support" },
    { value: "feedback", label: "Feedback" },
    { value: "partnership", label: "Partnership" },
  ];

  return (
    <MainLayout>
      <Head 
        title="Contact Us | Voyance" 
        description="Get in touch with the Voyance team. We're here to help with your travel planning questions and feedback." 
      />

      {/* Hero with image */}
      <section className="relative pt-20 pb-32 overflow-hidden">
        <div className="absolute inset-0">
          <img 
            src={normalizeUnsplashUrl("https://images.unsplash.com/photo-1521295121783-8a321d551ad2?w=1920&q=80")}
            alt=""
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/50 to-background" />
        </div>

        <div className="relative z-10 container max-w-4xl mx-auto px-4 pt-24 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <h1 className="font-display text-4xl md:text-6xl font-bold text-white mb-6">
              Let's Talk Travel
            </h1>
            <p className="text-xl text-white/80 max-w-2xl mx-auto">
              Questions about your trip? Ideas to share? We're all ears.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Contact Form Section */}
      <section className="py-16 -mt-20 relative z-20">
        <div className="container max-w-4xl mx-auto px-4">
          <div className="grid lg:grid-cols-5 gap-8">
            {/* Form */}
            <div className="lg:col-span-3">
              {isSuccess ? (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="bg-card border border-border rounded-2xl p-8 md:p-12 text-center shadow-lg"
                >
                  <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto mb-6">
                    <CheckCircle className="w-8 h-8 text-green-600" />
                  </div>
                  <h2 className="text-2xl font-display font-bold mb-3">Message Received!</h2>
                  <p className="text-muted-foreground mb-8">
                    We'll get back to you within {CONTACT_CONFIG.RESPONSE_TIME}. 
                    Keep an eye on your inbox.
                  </p>
                  <Button variant="outline" onClick={() => setIsSuccess(false)}>
                    Send Another Message
                  </Button>
                </motion.div>
              ) : (
                <motion.form
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  onSubmit={handleSubmit(onSubmit)}
                  className="bg-card border border-border rounded-2xl p-6 md:p-8 shadow-lg"
                >
                  <h2 className="text-xl font-display font-semibold mb-6">Send us a message</h2>
                  
                  <div className="space-y-5">
                    <div className="grid gap-5 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="name">Your name</Label>
                        <Input
                          id="name"
                          placeholder="Jane Smith"
                          {...register("name")}
                          className={errors.name ? "border-destructive" : ""}
                        />
                        {errors.name && (
                          <p className="text-sm text-destructive">{errors.name.message}</p>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="email">Email</Label>
                        <Input
                          id="email"
                          type="email"
                          placeholder="jane@example.com"
                          {...register("email")}
                          className={errors.email ? "border-destructive" : ""}
                        />
                        {errors.email && (
                          <p className="text-sm text-destructive">{errors.email.message}</p>
                        )}
                      </div>
                    </div>

                    <div className="grid gap-5 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="type">What's this about?</Label>
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
                          placeholder="Brief subject"
                          {...register("subject")}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="message">Your message</Label>
                      <Textarea
                        id="message"
                        placeholder="Tell us what's on your mind..."
                        rows={5}
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
                      className="w-full gap-2"
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Sending...
                        </>
                      ) : (
                        <>
                          Send Message
                          <Send className="w-4 h-4" />
                        </>
                      )}
                    </Button>
                  </div>
                </motion.form>
              )}
            </div>

            {/* Sidebar */}
            <div className="lg:col-span-2 space-y-6">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="bg-card border border-border rounded-2xl p-6 shadow-lg"
              >
                <h3 className="font-semibold mb-4">Email us directly</h3>
                <a 
                  href={`mailto:${CONTACT_CONFIG.SUPPORT_EMAIL}`}
                  className="flex items-center gap-3 text-primary hover:underline"
                >
                  <Mail className="h-5 w-5" />
                  {CONTACT_CONFIG.SUPPORT_EMAIL}
                </a>
                <p className="text-sm text-muted-foreground mt-3">
                  We typically respond within {CONTACT_CONFIG.RESPONSE_TIME}.
                </p>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="bg-gradient-to-br from-primary/10 to-accent/10 border border-primary/20 rounded-2xl p-6"
              >
                <h3 className="font-semibold mb-2">Looking for help?</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Check out our Help Center for quick answers to common questions.
                </p>
                <Button variant="outline" size="sm" asChild>
                  <a href="/help" className="gap-2">
                    Visit Help Center
                    <ArrowRight className="h-4 w-4" />
                  </a>
                </Button>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="rounded-2xl overflow-hidden"
              >
                <img 
                  src="https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=600&q=80"
                  alt="Travel inspiration"
                  className="w-full h-48 object-cover"
                />
              </motion.div>
            </div>
          </div>
        </div>
      </section>
    </MainLayout>
  );
};

export default Contact;